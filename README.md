# TripMate

เว็บแอปส่วนตัวสำหรับวางแผนเที่ยว แชร์ตำแหน่งล่าสุด เรียกเก็บเงิน และหารค่าใช้จ่ายกับเพื่อน ออกแบบแบบ mobile-first

## ทดลองใช้งาน

ต้องใช้ Node.js 18 ขึ้นไป (แนะนำ Node.js 20 LTS)

```bash
npm install
npm run dev
```

หากยังไม่ได้ตั้งค่า Supabase แอปจะเปิดเป็นโหมดเดโมและเก็บข้อมูลใน `localStorage` ของเบราว์เซอร์

## เปิดระบบจริงด้วย Supabase

1. สร้างโปรเจกต์ที่ [Supabase](https://supabase.com/dashboard)
2. โปรเจกต์ใหม่: รัน `supabase/schema.sql` แล้วรันไฟล์ใน `supabase/migrations/` ตามชื่อไฟล์จากเก่าไปใหม่
3. โปรเจกต์ TripMate เดิม: รันเฉพาะ migration ที่ยังไม่เคยรัน โดยไฟล์ล่าสุดคือ `20260820_security_admin_completion.sql`
4. ไปที่ **Authentication → URL Configuration** แล้วตั้ง Site URL เป็น URL ของ Vercel (ตอนพัฒนาใช้ URL ที่ Vite แสดง เช่น `http://localhost:5173`)
5. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ Project URL และ public anon key:

```bash
cp .env.example .env.local
```

```env
VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

6. ปิดและเปิด dev serverใหม่ด้วย `npm run dev`

ผู้ใช้คนแรกสมัครและสร้างทริปได้ทันที จากนั้นเจ้าของทริปกดไอคอนเพิ่มเพื่อน สร้างลิงก์เชิญเฉพาะคน แล้วส่งลิงก์ให้เพื่อน เพื่อนสมัครหรือล็อกอินผ่านลิงก์และจะถูกเพิ่มเข้าทริปอัตโนมัติ ลิงก์ใช้ได้ครั้งเดียวและหมดอายุใน 7 วัน

ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` ใน `.env.local` หรือไฟล์ frontend โดยเด็ดขาด

## ตรวจสอบก่อน deploy

```bash
npm test
npm run build
npm run preview
```

## Deploy ฟรี

1. สร้าง GitHub repository และ push โฟลเดอร์นี้
2. Import repository ใน Vercel
3. Framework Preset: Vite, Build Command: `npm run build`, Output: `dist`
4. เพิ่ม `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` ใน Vercel Environment Variables
5. Deploy แล้วนำ URL จริงกลับไปใส่ใน Supabase Authentication URL Configuration

ไฟล์ `vercel.json` เตรียมค่า Vite และ SPA rewrite ไว้แล้ว จึงไม่ต้องตั้งค่า route เพิ่มเอง

## หมายเหตุ Supabase

ระบบจริงใช้ Supabase Auth, Row Level Security และลิงก์เชิญแบบใช้ครั้งเดียว เจ้าของทริปสร้างลิงก์ได้ แต่สมาชิกทั่วไปสร้างไม่ได้ แพลน รายจ่าย และรายการเรียกเก็บจะถูกแชร์ผ่านฐานข้อมูลเดียวกันเมื่อเปิดโหมด Supabase

## ข้อจำกัดตำแหน่ง

เว็บต้องรันผ่าน HTTPS และผู้ใช้ต้องอนุญาตตำแหน่ง หากปิดเว็บหรือล็อกหน้าจอ ระบบปฏิบัติการอาจหยุดอัปเดต จึงควรแสดงเป็น “ตำแหน่งล่าสุด” ไม่ใช่การติดตามเบื้องหลังตลอดเวลา

การแจ้งเตือนบนเครื่องทำงานเมื่อผู้ใช้ติดตั้ง/เปิดเว็บไว้และอนุญาต Notification ส่วน push แบบปิดแอปเต็มรูปแบบต้องเพิ่ม Web Push provider หรือ Supabase Edge Function พร้อม VAPID keys ภายหลัง
