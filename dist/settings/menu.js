/* =========================================================================
   MAHA DUCK — Menu data
   ဟင်းပွဲ၊ ဈေးနှုန်း၊ ပုံ တွေကို ဒီမှာပြင်ပါ။ price: null ဆိုရင် "Coming soon" ပြပြီး order မှာလို့မရပါ။
   ========================================================================= */
window.MAHA_MENU = {
  // Step 1 — Build your bowl: ingredients are sold per 100 g
  // Mala Duck / ဘဲစပ် Set (Small / Medium / Big)
  // Customer က အရွယ်အစားရွေး → အသား/အသီးအရွက် ရွေး → အရသာ (Taste) ရွေး
  malaSet: {
    itemId: "mala-duck",
    addOns: true,    // Set ပြည့်ပြီးရင် တခြားပစ္စည်းကို တစ်မျိုးချင်းဈေး (အောက်က price) နဲ့ Add-on ထပ်ထည့်ခွင့်ပေးမယ်။ false = မပေးဘူး
    askSpicy: false, // true ပြောင်းရင် ဘဲစပ်မှာလည်း Spicy Level ရွေးခိုင်းမယ်
    sizes: [
      { id: "S", name: "Small", th: "เล็ก", my: "အသေး", price: 250, pick: 3 },
      { id: "M", name: "Medium", th: "กลาง", my: "အလတ်", price: 350, pick: 4 },
      { id: "B", name: "Big", th: "ใหญ่", my: "အကြီး", price: 450, pick: 5 },
    ],
    tastes: [
      { id: 1, name: "Hot & Sour Mala Salad", th: "ยำหม่าล่าเปรี้ยวเผ็ด" },
      { id: 2, name: "Crispy Fried in Fragrant Oil", th: "ทอดกรอบน้ำมันหอม" },
      { id: 3, name: "Mala Fragrant Oil", th: "คลุกน้ำมันหม่าล่าหอม" },
    ],
    // price = menu ပေါ်က တစ်မျိုးချင်းဈေး — Set ပြည့်ပြီးနောက် Add-on ထပ်ထည့်ရင် ဒီဈေးနဲ့ ပေါင်းမယ်
    groups: [
      { id: "duck", name: "Mala Duck", th: "หม่าล่าเป็ด", my: "ဘဲ", items: [
        { id: "duck-neck", name: "Duck Neck", th: "คอเป็ด", price: 70 },
        { id: "duck-head", name: "Duck Head", th: "หัวเป็ด", price: 70 },
        { id: "duck-wing", name: "Duck Wing", th: "ปีกเป็ด", price: 35 },
        { id: "duck-feet", name: "Duck Feet", th: "ตีนเป็ด", price: 25 },
        { id: "duck-leg", name: "Duck Leg", th: "น่องเป็ด", price: 150 },
        { id: "duck-mushroom", name: "Duck Mushroom", th: "เห็ดเป็ด", price: 40 },
        { id: "duck-tongue", name: "Duck Tongue", th: "ลิ้นเป็ด", price: 120 },
        { id: "duck-intestine", name: "Duck Intestine", th: "ไส้เป็ด", price: 120 },
      ] },
      { id: "chicken", name: "Mala Chicken", th: "หม่าล่าไก่", my: "ကြက်", items: [
        { id: "chicken-leg", name: "Chicken Leg", th: "น่องไก่", price: 90 },
        { id: "chicken-feet", name: "Chicken Feet", th: "ตีนไก่", price: 25 },
        { id: "chicken-cartilage", name: "Chicken Cartilage", th: "กระดูกอ่อนไก่", price: 70 },
      ] },
      { id: "beefpork", name: "Beef & Pork", th: "เนื้อวัวและหมู", my: "အမဲ နှင့် ဝက်", items: [
        { id: "beef", name: "Beef", th: "เนื้อวัว", price: 99 },
        { id: "beef-intestine", name: "Beef Intestine", th: "ไส้วัว", price: 99 },
        { id: "beef-omasum", name: "Beef Omasum", th: "ผ้าขี้ริ้ววัว", price: 99 },
        { id: "pig-ear", name: "Pig Ear", th: "หูหมู", price: 120 },
      ] },
      { id: "tofu", name: "Tofu & Mushroom", th: "เต้าหู้และเห็ด", my: "တိုဟူး နှင့် မှို", items: [
        { id: "enoki", name: "Enoki Mushroom", th: "เห็ดเข็มทอง", price: 60 },
        { id: "wood-ear", name: "Wood Ear Mushroom", th: "เห็ดหูหนู", price: 50 },
        { id: "tofu", name: "Tofu", th: "เต้าหู้", price: 50 },
        { id: "tofu-cubes", name: "Tofu Cubes", th: "เต้าหู้ก้อน", price: 60 },
        { id: "shredded-tofu", name: "Shredded Tofu", th: "เต้าหู้เส้น", price: 50 },
        { id: "tofu-skin-roll", name: "Tofu Skin Roll", th: "ฟองเต้าหู้ม้วน", price: 50 },
      ] },
      { id: "others", name: "Others", th: "อื่น ๆ", my: "အခြား", items: [
        { id: "prawn", name: "Prawn", th: "กุ้ง", price: 100 },
        { id: "sausage", name: "Hot Dog Sausage", th: "ไส้กรอก", price: 40 },
        { id: "quail-eggs", name: "Quail Eggs", th: "ไข่นกกระทา", price: 35 },
      ] },
      { id: "veg", name: "Mala Vegetable", th: "หม่าล่าผัก", my: "အသီးအရွက်", items: [
        { id: "lotus-root", name: "Lotus Root", th: "รากบัว", price: 50 },
        { id: "potato", name: "Potato", th: "มันฝรั่ง", price: 50 },
        { id: "banana-blossom", name: "Banana Blossom", th: "หัวปลี", price: 50 },
        { id: "bamboo-shoots", name: "Bamboo Shoots", th: "หน่อไม้", price: 80 },
        { id: "edamame", name: "Edamame", th: "ถั่วแระญี่ปุ่น", price: 50 },
        { id: "gongcai", name: "Gongcai", th: "ผักก้งฉ่าย", price: 60 },
        { id: "seaweed", name: "Seaweed", th: "สาหร่ายทะเล", price: 50 },
        { id: "kelp-sticks", name: "Kelp Sticks", th: "สาหร่ายคอมบุแท่ง", price: 50 },
      ] },
    ],
  },

  // Build your bowl (ချိန်ရောင်း) — enabled: false = website နဲ့ POS မှာ မပြတော့ဘူး။ ပြန်ဖွင့်ချင်ရင် true ပြောင်းပါ။
  bowl: {
    enabled: false,
    pricePer100g: { meat: 55, veg: 55 },
    dishes: [
      { id: "malatang", name: "Mala Tang", th: "หม่าล่าทั่ง", kind: "soup", img: "images/dishes/dish-malatang.webp" },
      { id: "xiangguo", name: "Mala Xiang Guo", th: "หม่าล่าเซียงกัว", kind: "dry", img: "images/dishes/dish-xiangguo.webp" },
    ],
    styles: [
      { id: "S1", dish: "malatang", name: "Spicy Bone Broth", th: "น้ำซุปกระดูกหม่าล่า", heat: 1, img: "images/broths/style-s1.webp" },
      { id: "S2", dish: "malatang", name: "Rich Tomato Soup", th: "ซุปมะเขือเทศเข้มข้น", heat: 0, img: "images/broths/style-s2.webp" },
      { id: "S3", dish: "malatang", name: "Fresh Mushroom Soup", th: "ซุปเห็ดสด", heat: 0, img: "images/broths/style-s3.webp" },
      { id: "S4", dish: "malatang", name: "Pumpkin Soup", th: "ซุปฟักทอง", heat: 0, img: "images/broths/style-s4.webp" },
      { id: "S5", dish: "xiangguo", name: "Spicy Dry Pot", th: "หม้อแห้งหม่าล่า", heat: 3, img: "images/broths/style-s5.webp" },
    ],
    ingredients: {
      meat: [
        { id: "beef", name: "Sliced beef", th: "เนื้อสไลซ์" },
        { id: "pork", name: "Sliced pork", th: "หมูสไลซ์" },
        { id: "chicken", name: "Chicken", th: "ไก่" },
        { id: "shrimp", name: "Shrimp", th: "กุ้ง" },
        { id: "squid", name: "Squid", th: "ปลาหมึก" },
        { id: "fishball", name: "Fish balls", th: "ลูกชิ้นปลา" },
        { id: "porkball", name: "Pork balls", th: "ลูกชิ้นหมู" },
        { id: "crab", name: "Crab sticks", th: "ปูอัด" },
        { id: "quail", name: "Quail eggs", th: "ไข่นกกระทา" },
        { id: "fishtofu", name: "Fish tofu", th: "เต้าหู้ปลา" },
      ],
      veg: [
        { id: "enoki", name: "Enoki mushroom", th: "เห็ดเข็มทอง" },
        { id: "shiitake", name: "Shiitake", th: "เห็ดหอม" },
        { id: "woodear", name: "Wood ear", th: "เห็ดหูหนู" },
        { id: "lotus", name: "Lotus root", th: "รากบัว" },
        { id: "bokchoy", name: "Bok choy", th: "ผักกวางตุ้ง" },
        { id: "napa", name: "Napa cabbage", th: "ผักกาดขาว" },
        { id: "babycorn", name: "Baby corn", th: "ข้าวโพดอ่อน" },
        { id: "broccoli", name: "Broccoli", th: "บรอกโคลี" },
        { id: "potato", name: "Potato", th: "มันฝรั่ง" },
        { id: "pumpkin", name: "Pumpkin", th: "ฟักทอง" },
        { id: "tofu", name: "Tofu", th: "เต้าหู้" },
        { id: "tofuskin", name: "Tofu skin", th: "ฟองเต้าหู้" },
        { id: "glassnoodle", name: "Glass noodles", th: "วุ้นเส้น" },
        { id: "instantnoodle", name: "Instant noodles", th: "บะหมี่กึ่งสำเร็จรูป" },
      ],
    },
  },

  // Spicy Level 1–5 (Level 0 = မစပ် ကို website က အလိုအလျောက်ထည့်ပေးတယ်)
  spicy: [
    { level: 1, name: "Mild", th: "เผ็ดน้อย", my: "နည်းနည်းစပ်", sub: "A little kick!", img: "images/spice/level-1.webp" },
    { level: 2, name: "Medium", th: "เผ็ดกลาง", my: "အလယ်အလတ်", sub: "Getting spicy!", img: "images/spice/level-2.webp" },
    { level: 3, name: "Hot", th: "เผ็ด", my: "စပ်", sub: "Hotter!", img: "images/spice/level-3.webp" },
    { level: 4, name: "Very hot", th: "เผ็ดมาก", my: "အရမ်းစပ်", sub: "Bring the heat!", img: "images/spice/level-4.webp" },
    { level: 5, name: "Extra hot", th: "เผ็ดสุด", my: "အစပ်ဆုံး", sub: "Fire!", img: "images/spice/level-5.webp" },
  ],

  // Ready-made dishes
  // =====================================================================
  // Website မှာ ပြမယ့် menu
  //   meats: [...]  = အသားရွေးခိုင်းမယ် (အသားအလိုက် ဈေးနှုန်း)
  //   soups: [...]  = Soup ရွေးခိုင်းမယ်
  //   spicy: true   = Spicy Level 0–5 ရွေးခိုင်းမယ်
  //   set: true     = Mala Duck (အပေါ်က malaSet အတိုင်း Size → ရွေးစရာ → အရသာ)
  // =====================================================================
  sections: [
    {
      id: "main",
      feature: true,
      title: { en: "Main Dish Set Menu", th: "เมนูชุดหลัก", my: "Main Dish Set Menu" },
      note: {
        en: "Online orders come in our prepared set portion. Dine in at the shop for even more choices.",
        th: "ออเดอร์ออนไลน์จัดเป็นชุดตามที่ร้านเตรียมไว้ มาทานที่ร้านมีตัวเลือกให้เลือกมากกว่า",
        my: "Order တွင် Set Menu အတွက်ပြင်ဆင်ထားသော Set Portion အတိုင်းရရှိမှာဖြစ်ပြီး ဆိုင်တွင်လာရောက်သုံးဆောင်ပါက ရွေးချယ်စရာအမျိုးအမည်များ ပိုမိုစုံလင်ပါတယ်။",
      },
      items: [
        {
          id: "mala-xiangguo", name: "Mala Xiang Guo", th: "หม่าล่าเซียงกัว", my: "မာလာရှမ်းကော",
          desc: { en: "Dry-tossed mala pot. Choose your meat and spicy level.", th: "หม่าล่าผัดแห้ง เลือกเนื้อสัตว์และระดับความเผ็ด", my: "နှစ်သက်ရာ အသား နှင့် Spicy Level ကို ရွေးချယ်ကာ မှာယူနိုင်ပါတယ်။" },
          img: "images/dishes/dish-xiangguo.webp", price: 199, spicy: true,
          meats: [
            { id: "chicken", name: "Chicken", th: "ไก่", my: "ကြက်သား", price: 199 },
            { id: "pork", name: "Pork", th: "หมู", my: "ဝက်သား", price: 199 },
            { id: "beef", name: "Beef", th: "เนื้อวัว", my: "အမဲသား", price: 249 },
          ],
        },
        {
          id: "malatang", name: "Malatang", th: "หม่าล่าทั่ง", my: "မာလာထန်",
          desc: { en: "Mala soup bowl. Choose your meat, soup and spicy level.", th: "หม่าล่าน้ำซุป เลือกเนื้อสัตว์ น้ำซุป และระดับความเผ็ด", my: "နှစ်သက်ရာ အသား၊ Soup နှင့် Spicy Level ကို ရွေးချယ်ကာ မှာယူနိုင်ပါတယ်။" },
          img: "images/dishes/dish-malatang.webp", price: 199, spicy: true,
          meats: [
            { id: "chicken", name: "Chicken", th: "ไก่", my: "ကြက်သား", price: 199 },
            { id: "pork", name: "Pork", th: "หมู", my: "ဝက်သား", price: 199 },
            { id: "beef", name: "Beef", th: "เนื้อวัว", my: "အမဲသား", price: 249 },
          ],
          // ⚠️ ပုံတွေက ယာယီတွဲထားတာပါ — Soup အလိုက် ပုံအမှန်ရရင် images/broths/ ထဲထည့်ပြီး img ကိုပြောင်းပါ
          soups: [
            { id: "mala", name: "Mala Soup", th: "ซุปหม่าล่า", img: "images/broths/style-s1.webp" },
            { id: "bone", name: "Bone Soup", th: "ซุปกระดูก", img: "images/broths/style-s3.webp" },
            { id: "collagen", name: "Collagen Soup", th: "ซุปคอลลาเจน", img: "images/broths/style-s4.webp" },
            { id: "signature", name: "Signature Soup", th: "ซุปซิกเนเจอร์", img: "images/broths/style-s2.webp" },
          ],
        },
        {
          id: "mala-duck", name: "Mala Duck", th: "เป็ดหม่าล่า", my: "ဘဲစပ်",
          desc: { en: "Choose your size, your meats & vegetables (Small 3, Medium 4, Big 5) and your taste.", th: "เลือกขนาด เลือกเนื้อสัตว์และผัก (เล็ก 3 กลาง 4 ใหญ่ 5 อย่าง) และรสชาติ", my: "စားပွဲဆိုဒ်၊ နှစ်သက်ရာ အသား/အသီးအရွက် (အသေး 3၊ အလတ် 4၊ အကြီး 5 မျိုး) နှင့် အရသာ ကို ရွေးချယ်ကာ မှာယူနိုင်ပါတယ်။" },
          price: 250, set: true, img: "images/dishes/dish-duck.webp", badge: "signature",
        },
      ],
    },
    {
      id: "dishes",
      title: { en: "Dishes & Appetizers", th: "กับข้าวและของทานเล่น", my: "Dishes & Appetizers" },
      items: [
        { id: "suancaiyu", name: "Suan Cai Yu", th: "ปลาต้มผักกาดดอง", my: "Suan Cai Dish",
          desc: { en: "Tender fish slices in tangy pickled-cabbage broth with chilli oil.", th: "ปลาเนื้อนุ่มในน้ำซุปผักกาดดองรสเปรี้ยวเผ็ด", my: "ငါးသားကို မုန်ညင်းချဉ်ဟင်းရည်၊ ငရုတ်ဆီနှင့်" },
          price: 199, img: "images/dishes/dish-suancaiyu.webp", spicy: true },
        { id: "sichuan", name: "Sichuan Dish", base: "Sichuan", th: "ผัดเสฉวน", price: 199, spicy: true, art: "sichuan",
          meats: [
            { id: "chicken", name: "Chicken", th: "ไก่", my: "ကြက်သား", price: 199 },
            { id: "pork", name: "Pork", th: "หมู", my: "ဝက်သား", price: 199 },
            { id: "beef", name: "Beef", th: "เนื้อวัว", my: "အမဲသား", price: 199 },
          ] },
        { id: "fried-chicken", name: "Sichuan-style Crispy Fried Chicken", th: "ไก่ทอดกรอบสไตล์เสฉวน", price: 89, img: "images/snacks/snack-chicken.webp" },
        { id: "rice-cake", name: "Japanese Fried Sweet Rice Cake", th: "โมจิทอดหวานญี่ปุ่น", price: 89, img: "images/snacks/snack-mochi.webp" },
        { id: "doughnuts", name: "Giant Crispy Doughnuts", th: "โดนัทกรอบยักษ์", price: 89, img: "images/snacks/snack-doughnut.webp" },
        { id: "rice", name: "Steamed Rice", th: "ข้าวสวย", price: 25, art: "rice" },
      ],
    },
  ],
};
