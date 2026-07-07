# Load Test — Pattani FC

k6 scripts สำหรับทดสอบภาระโหลดเว็บไซต์ `pattanifc.co`

## ติดตั้ง k6 บน Windows

**วิธีที่ 1 — Chocolatey (แนะนำ)**
```powershell
choco install k6
```

**วิธีที่ 2 — winget**
```powershell
winget install k6 --source winget
```

**วิธีที่ 3 — ดาวน์โหลด binary ตรง**
https://github.com/grafana/k6/releases → `k6-vX.Y.Z-windows-amd64.zip`
แตกไฟล์แล้ว copy `k6.exe` ไปที่โฟลเดอร์ที่อยู่ใน PATH เช่น `C:\Windows\System32`

ตรวจสอบว่าติดตั้งสำเร็จ:
```powershell
k6 version
```

## สคริปต์ที่มี

| ไฟล์ | จำนวน user | เวลา | จุดประสงค์ |
|---|---|---|---|
| `smoke.js` | 1 | 30s | เช็คว่า endpoint ทำงานปกติ ก่อนยิงจริง |
| `browse.js` | ramp 50→500 | ~5 นาที | จำลอง user เดินดูเว็บแบบจริง |
| `ticket-peak.js` | burst ถึง 2000 rps | ~2.5 นาที | จำลองวันเปิดจองตั๋ว |
| `stress.js` | ramp 100→4000 | ~10 นาที | หา breaking point ของ server |

## วิธีรัน

```powershell
cd load-test

# 1. เริ่มจาก smoke ก่อนเสมอ (เช็คว่าไม่พังตั้งแต่ต้น)
k6 run smoke.js

# 2. Realistic browse flow
k6 run browse.js

# 3. Peak scenario — ตรงกับวันเปิดจอง
k6 run ticket-peak.js

# 4. Stress test — ระวัง อาจล้ม server จริง
k6 run stress.js
```

### เปลี่ยน target URL / match ID
```powershell
k6 run -e BASE_URL=https://staging.pattanifc.co browse.js
k6 run -e MATCH_ID=cmrxxxxxxxx ticket-peak.js
```

### บันทึกผลลง JSON / HTML report
```powershell
k6 run --out json=results.json browse.js
```

หรือใช้ handleSummary + `k6-html-reporter` เพิ่มเติมได้

## ขั้นตอนที่แนะนำ

1. **รัน `smoke.js` ก่อนเสมอ** — เพื่อเช็คว่าเทสไม่พังตั้งแต่เขียน
2. **รัน `browse.js`** ในช่วงกลางคืน (ตี 2-4) เพื่อดู baseline
3. **เปิด `htop` / `Task Manager` บน server** ดู CPU/RAM ระหว่างเทส
4. **เปิด Postgres slow query log** ก่อนเทส เพื่อจับ query ที่ช้า
5. **`ticket-peak.js`** รันได้ต่อเมื่อระบบผ่าน browse.js แล้ว
6. **`stress.js`** รันหลังสุด — จะได้รู้ว่า server ล้มที่กี่ VU

## ตัวเลข thresholds ที่ตั้งไว้

| Threshold | ค่า | ความหมาย |
|---|---|---|
| `http_req_failed` | < 1-5% | อัตรา error ที่ยอมรับได้ |
| `http_req_duration p(95)` | < 3-5s | 95% ของ request ต้องเสร็จภายใน 3-5 วิ |
| `http_req_duration p(99)` | < 5-10s | 99% ต้องเสร็จภายใน 5-10 วิ |

ถ้าเกิน threshold → k6 จะ exit code 99 (fail)

## สิ่งที่ควรวัดคู่กัน (ฝั่ง server)

รันคำสั่งนี้บน server (`ssh root@165.101.65.151`) ระหว่างเทส:

```bash
# CPU / RAM realtime
htop

# หรือใช้ vmstat
vmstat 1

# Postgres active connections
sudo -u postgres psql -d pattani -c "SELECT count(*) FROM pg_stat_activity;"

# nginx error log
tail -f /var/log/nginx/error.log

# Node.js logs (ถ้าใช้ pm2)
pm2 logs
```

## ⚠️ ข้อควรระวัง

- **แจ้ง hosting provider** ก่อนรัน stress test (อาจถูกมองว่า DDoS)
- **ทดสอบตอน off-peak** ตี 2-4 ไม่กระทบผู้ใช้จริง
- **Backup database** ก่อนเทสที่มี write operation
- **อย่ารัน stress.js บ่อยๆ** — อาจ trigger fail2ban / cloud provider rate limit
- สคริปต์ปัจจุบัน **เทสเฉพาะ GET (read-only)** — ยังไม่มีการยิง booking API เพราะต้องเตรียม test user + test match ก่อน

## สิ่งที่ยังไม่ได้ทำ (ต้องเพิ่มถ้าอยากเทส booking flow จริง)

- Login flow (ต้อง signed JWT session)
- POST `/api/bookings` — จำลองจองจริง
- Concurrency test ที่นั่งเดียวกัน — เช็คว่า row lock ป้องกัน double-booking ได้จริง

แจ้งได้ถ้าอยากให้ทำเพิ่ม
