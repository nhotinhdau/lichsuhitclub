const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

const POLL_INTERVAL = 5000;
const RETRY_DELAY = 5000;
const MAX_HISTORY = 50;

let latest100 = { Phien: 0, Xuc_xac_1: 0, Xuc_xac_2: 0, Xuc_xac_3: 0, Tong: 0, Ket_qua: "Chưa có" };
let latest101 = { Phien: 0, Xuc_xac_1: 0, Xuc_xac_2: 0, Xuc_xac_3: 0, Tong: 0, Ket_qua: "Chưa có" };

let history100 = [];
let history101 = [];

let lastSid100 = null;
let lastSid101 = null;
let sidForTX = null;

function getTaiXiu(d1, d2, d3) {
  const total = d1 + d2 + d3;
  return total <= 10 ? "Xỉu" : "Tài";
}

function updateResult(store, history, result) {
  Object.assign(store, result);
  history.unshift({ ...result });
  if (history.length > MAX_HISTORY) history.pop();
}

async function pollApi(gid, isMd5) {
  const url = `https://jakpotgwab.geightdors.net/glms/v1/notify/taixiu?platform_id=g8&gid=${gid}`;
  while (true) {
    try {
      const resp = await axios.get(url, { headers: { "User-Agent": "Node-Proxy/1.0" }, timeout: 10000 });
      const data = resp.data;
      if (data.status === "OK" && Array.isArray(data.data)) {
        for (const game of data.data) {
          const cmd = game.cmd;
          if (!isMd5 && cmd === 1008) {
            sidForTX = game.sid;
          }
        }

        for (const game of data.data) {
          const cmd = game.cmd;
          if (isMd5 && cmd === 2006) {
            const sid = game.sid;
            const { d1, d2, d3 } = game;
            if (sid && sid !== lastSid101 && d1 != null && d2 != null && d3 != null) {
              lastSid101 = sid;
              const total = d1 + d2 + d3;
              const ketQua = getTaiXiu(d1, d2, d3);
              const result = { Phien: sid, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: ketQua };
              updateResult(latest101, history101, result);
              console.log(`[MD5] Phiên ${sid} - Tổng: ${total}, Kết quả: ${ketQua}`);
            }
          } else if (!isMd5 && cmd === 1003) {
            const { d1, d2, d3 } = game;
            const sid = sidForTX;
            if (sid && sid !== lastSid100 && d1 != null && d2 != null && d3 != null) {
              lastSid100 = sid;
              const total = d1 + d2 + d3;
              const ketQua = getTaiXiu(d1, d2, d3);
              const result = { Phien: sid, Xuc_xac_1: d1, Xuc_xac_2: d2, Xuc_xac_3: d3, Tong: total, Ket_qua: ketQua };
              updateResult(latest100, history100, result);
              console.log(`[TX] Phiên ${sid} - Tổng: ${total}, Kết quả: ${ketQua}`);
              sidForTX = null;
            }
          }
        }
      }
    } catch (e) {
      console.error(`Lỗi khi lấy dữ liệu API ${gid}:`, e.message);
      await new Promise(r => setTimeout(r, RETRY_DELAY));
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

// format chuẩn xuất ra
function formatResult(result) {
  return {
    Phien: result.Phien,
    Xuc_xac_1: result.Xuc_xac_1,
    Xuc_xac_2: result.Xuc_xac_2,
    Xuc_xac_3: result.Xuc_xac_3,
    Tong: result.Tong,
    Ket_qua: result.Ket_qua
  };
}

// Start polling
pollApi("vgmn_100", false);
pollApi("vgmn_101", true);

// API endpoints
app.get("/api/taixiu", (req, res) => res.json(formatResult(latest100)));
app.get("/api/taixiumd5", (req, res) => res.json(formatResult(latest101)));
app.get("/api/history", (req, res) => res.json({
  taixiu: history100.map(formatResult),
  taixiumd5: history101.map(formatResult)
}));
app.get("/", (req, res) => res.send("API Server for TaiXiu is running. Endpoints: /api/taixiu, /api/taixiumd5, /api/history"));

app.listen(PORT, () => console.log(`Server chạy trên cổng ${PORT}`));
