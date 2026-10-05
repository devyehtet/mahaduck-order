/* =========================================================================
   MAHA DUCK — Shop settings
   ဆိုင်အချက်အလက်၊ ဈေးနှုန်း၊ Supabase key တွေကို ဒီ file တစ်ခုတည်းမှာ ပြင်ပါ။
   ========================================================================= */
window.MAHA_CONFIG = {
  shopName: "Maha Duck",
  tagline: "The Master of Mala",
  location: "Phloen Chit, Bangkok",
  phone: "", // ဥပမာ "+66 81 234 5678" — ထည့်ရင် website အောက်ခြေမှာ ပြမယ်
  // ဆိုင်ရဲ့ Facebook Page — Page username (ဥပမာ "mahaduckbkk") သို့မဟုတ် link အပြည့် (https://m.me/...) ထည့်ပါ။
  // ထည့်ရင် "Slip တွဲလို့မရရင် Messenger ကပို့ပါ" နေရာမှာ Messenger ခလုတ်ပေါ်မယ်။ ဗလာထားရင် စာပဲပြမယ်။
  messenger: "mahaduckbkk", // https://www.facebook.com/mahaduckbkk → Messenger: https://m.me/mahaduckbkk
  currency: "฿",

  // ---- Supabase (online orders database) ----
  // ဗလာထားရင် "Demo mode" — order တွေက ဒီ browser ထဲမှာပဲ သိမ်းမယ်။
  // SETUP-GUIDE-MY.md ထဲက အဆင့်တွေအတိုင်း ဖြည့်ပါ။
  supabaseUrl: "",
  supabaseAnonKey: "",
  staffLogin: {
    email: "info@yehtet.com",
  },

  // ---- Ordering ----
  orderTypes: ["delivery", "pickup", "dinein"],
  deliveryFee: null,      // null = အောက်က "delivery" အတိုင်း အကွာအဝေးနဲ့တွက်မယ်။ နံပါတ်ထည့်ရင် (ဥပမာ 40) နေရာတိုင်း ဈေးတစ်ခုတည်း
  // ---- Delivery ခ တွက်နည်း (အကွာအဝေးအလိုက်) ----
  // GrabExpress (Bike) Bangkok ရဲ့ ထုတ်ပြန်ထားတဲ့ နှုန်းအတိုင်း: စ ฿36 + ကီလိုမီတာအလိုက်။
  // Grab app ထဲက တကယ့်ဈေးက အချိန်/မိုး/rider အလိုက် အတက်အကျရှိလို့ ဒါက ခန့်မှန်းဈေးပါ — လိုသလိုပြင်နိုင်ပါတယ်။
  delivery: {
    shopLat: 13.7431,   // ⚠️ ဆိုင်ရဲ့တည်နေရာ — အခု Phloen Chit BTS ကို ယာယီထည့်ထားတယ်။
    shopLng: 100.5490,  //    Google Maps မှာ ဆိုင်ကို right-click → ကိန်းဂဏန်း ၂ လုံးကို copy ပြီး ဒီမှာထည့်ပါ။
    roadFactor: 1.35,   // မျဉ်းဖြောင့်အကွာအဝေး → လမ်းအကွာအဝေး (Bangkok ပျမ်းမျှ)
    baseFare: 36,       // စဈေး (฿)
    tiers: [            // ကီလိုမီတာအလိုက်နှုန်း (฿/km)
      { upToKm: 12, perKm: 7.4 },
      { upToKm: 20, perKm: 7.6 },
      { upToKm: 30, perKm: 8.1 },
      { upToKm: 999, perKm: 14 },
    ],
    extra: 0,           // ဆိုင်က ထပ်ပေါင်းချင်တဲ့ပမာဏ (฿) — ဥပမာ ထုပ်ပိုးခ
    roundTo: 1,         // 5 ထားရင် ฿5 ပြည့်အောင် အပေါ်ကိုတင်မယ်
    maxKm: 20,          // ဒီထက်ဝေးရင် "ဆိုင်က အတည်ပြုပေးမယ်" လို့ပြမယ်
    // Customer ရွေးလို့ရတဲ့ နေရာစာရင်း (GPS မသုံးချင်သူအတွက်) — လိုသလို ထပ်ထည့်/ဖျက်နိုင်ပါတယ်
    areas: [
      { name: "Phloen Chit", th: "เพลินจิต", lat: 13.7431, lng: 100.5490 },
      { name: "Chit Lom", th: "ชิดลม", lat: 13.7441, lng: 100.5430 },
      { name: "Ratchadamri", th: "ราชดำริ", lat: 13.7393, lng: 100.5394 },
      { name: "Siam", th: "สยาม", lat: 13.7456, lng: 100.5341 },
      { name: "Pratunam", th: "ประตูน้ำ", lat: 13.7500, lng: 100.5410 },
      { name: "Nana", th: "นานา", lat: 13.7406, lng: 100.5553 },
      { name: "Asok / Sukhumvit", th: "อโศก", lat: 13.7370, lng: 100.5604 },
      { name: "Phrom Phong", th: "พร้อมพงษ์", lat: 13.7305, lng: 100.5697 },
      { name: "Thong Lo", th: "ทองหล่อ", lat: 13.7243, lng: 100.5785 },
      { name: "Ekkamai", th: "เอกมัย", lat: 13.7196, lng: 100.5852 },
      { name: "Phra Khanong", th: "พระโขนง", lat: 13.7152, lng: 100.5912 },
      { name: "On Nut", th: "อ่อนนุช", lat: 13.7056, lng: 100.6011 },
      { name: "Udom Suk", th: "อุดมสุข", lat: 13.6799, lng: 100.6095 },
      { name: "Bang Na", th: "บางนา", lat: 13.6682, lng: 100.6046 },
      { name: "Lumphini", th: "ลุมพินี", lat: 13.7257, lng: 100.5457 },
      { name: "Khlong Toei", th: "คลองเตย", lat: 13.7223, lng: 100.5539 },
      { name: "Silom / Sala Daeng", th: "สีลม / ศาลาแดง", lat: 13.7285, lng: 100.5343 },
      { name: "Sathorn / Chong Nonsi", th: "สาทร / ช่องนนทรี", lat: 13.7237, lng: 100.5294 },
      { name: "Surasak", th: "สุรศักดิ์", lat: 13.7193, lng: 100.5216 },
      { name: "Sam Yan", th: "สามย่าน", lat: 13.7325, lng: 100.5290 },
      { name: "Hua Lamphong", th: "หัวลำโพง", lat: 13.7378, lng: 100.5169 },
      { name: "Ratchathewi", th: "ราชเทวี", lat: 13.7519, lng: 100.5316 },
      { name: "Phaya Thai", th: "พญาไท", lat: 13.7569, lng: 100.5338 },
      { name: "Victory Monument", th: "อนุสาวรีย์ชัยฯ", lat: 13.7628, lng: 100.5372 },
      { name: "Ari", th: "อารีย์", lat: 13.7797, lng: 100.5446 },
      { name: "Phetchaburi / Makkasan", th: "เพชรบุรี / มักกะสัน", lat: 13.7487, lng: 100.5633 },
      { name: "Rama 9", th: "พระราม 9", lat: 13.7573, lng: 100.5652 },
      { name: "Din Daeng", th: "ดินแดง", lat: 13.7697, lng: 100.5530 },
      { name: "Huai Khwang", th: "ห้วยขวาง", lat: 13.7786, lng: 100.5737 },
      { name: "Chatuchak / Mo Chit", th: "จตุจักร / หมอชิต", lat: 13.8025, lng: 100.5538 },
      { name: "Lat Phrao", th: "ลาดพร้าว", lat: 13.8063, lng: 100.5733 },
    ],
  },
  minOrder: 0,            // အနည်းဆုံး order ပမာဏ (฿)
  paymentMethods: ["cash"],

  // ---- PromptPay QR ----
  // ဆိုင်ရဲ့ PromptPay နံပါတ် (ဖုန်း 08xxxxxxxx သို့ Tax ID 13 လုံး) ထည့်ရင်
  // Customer ကို ပမာဏပါပြီးသား QR အလိုအလျောက်ပြမယ်။ ဗလာထားရင် "ဆိုင်က QR ပို့ပေးမယ်" လို့ပြမယ်။
  promptpayId: "004999145373766", // ဆိုင်ရဲ့ K+ Thai QR ထဲက Ref ID (QR ပုံအောက်မှာပါတဲ့နံပါတ်)
  promptpayName: "MS. HNIN YEE HTUN WIN", // ငွေလက်ခံသူနာမည် (bank app မှာပေါ်မယ့်နာမည်) — customer စစ်လို့ရအောင်

  // ---- Printer / POS ----
  receiptFooter: "Thank you! · ขอบคุณค่ะ · ကျေးဇူးတင်ပါတယ်",
  pollSeconds: 10,        // Dashboard က order အသစ်ကို ဘယ်နှစ်စက္ကန့်တစ်ခါ စစ်မလဲ
};
