const menu = [
  {
    id: "signature-bowl",
    name: "Signature Malatang Bowl",
    category: "Bowls",
    price: 6500,
    description: "မားလာဟင်းရည်၊ အသီးအရွက်၊ mushroom၊ tofu၊ noodle စုံစုံလင်လင်",
    tags: ["Popular", "Soup"],
  },
  {
    id: "dry-mala",
    name: "Dry Mala Mix",
    category: "Bowls",
    price: 7000,
    description: "မားလာဆီမွှေးနဲ့ dry mix အဖြစ်တင်ပေးတဲ့ spicy bowl",
    tags: ["Hot", "Dry"],
  },
  {
    id: "clear-soup",
    name: "Clear Soup Bowl",
    category: "Bowls",
    price: 5500,
    description: "အစပ်မစားသူတွေအတွက် clear broth၊ vegetable နဲ့ noodle",
    tags: ["Mild"],
  },
  {
    id: "beef-slice",
    name: "Beef Slice",
    category: "Meat",
    price: 2500,
    description: "ဟင်းရည်ထဲမှာနူးညံ့အောင်ချက်ပေးတဲ့ beef slice",
    tags: ["Add-on"],
  },
  {
    id: "chicken-slice",
    name: "Chicken Slice",
    category: "Meat",
    price: 1800,
    description: "ပါးပါးလှီးထားတဲ့ chicken slice",
    tags: ["Add-on"],
  },
  {
    id: "pork-belly",
    name: "Pork Belly",
    category: "Meat",
    price: 2200,
    description: "ဆီစိမ့်ပြီးအရသာပြည့်တဲ့ pork belly slice",
    tags: ["Rich"],
  },
  {
    id: "fish-ball",
    name: "Fish Ball Skewer",
    category: "Skewers",
    price: 1200,
    description: "မားလာ bowl နဲ့လိုက်ဖက်တဲ့ fish ball skewer",
    tags: ["Skewer"],
  },
  {
    id: "tofu-skin",
    name: "Tofu Skin Roll",
    category: "Skewers",
    price: 1000,
    description: "ဟင်းရည်စုပ်ကောင်းတဲ့ tofu skin roll",
    tags: ["Vegetarian"],
  },
  {
    id: "mushroom-mix",
    name: "Mushroom Mix",
    category: "Vegetables",
    price: 1500,
    description: "Enoki, shiitake, wood ear mushroom စုံစုံလင်လင်",
    tags: ["Fresh"],
  },
  {
    id: "bok-choy",
    name: "Bok Choy",
    category: "Vegetables",
    price: 900,
    description: "ဟင်းရည်ထဲမှာလတ်လတ်ဆတ်ဆတ်ထည့်ပေးတဲ့ bok choy",
    tags: ["Fresh"],
  },
  {
    id: "lotus-root",
    name: "Lotus Root",
    category: "Vegetables",
    price: 1000,
    description: "Crunchy texture ကြိုက်သူတွေအတွက် lotus root",
    tags: ["Crunchy"],
  },
  {
    id: "instant-noodle",
    name: "Instant Noodle",
    category: "Noodles",
    price: 900,
    description: "မားလာဟင်းရည်နဲ့စားကောင်းတဲ့ noodle add-on",
    tags: ["Add-on"],
  },
  {
    id: "glass-noodle",
    name: "Glass Noodle",
    category: "Noodles",
    price: 1000,
    description: "ဟင်းရည်စုပ်ပြီးနူးညံ့တဲ့ glass noodle",
    tags: ["Add-on"],
  },
  {
    id: "thai-tea",
    name: "Thai Milk Tea",
    category: "Drinks",
    price: 1800,
    description: "အစပ်ဖြေဖို့ creamy Thai milk tea",
    tags: ["Cold"],
  },
  {
    id: "lemon-tea",
    name: "Lemon Tea",
    category: "Drinks",
    price: 1500,
    description: "ချဉ်ချိုအေးအေး lemon tea",
    tags: ["Cold"],
  },
  {
    id: "water",
    name: "Water",
    category: "Drinks",
    price: 500,
    description: "ရေသန့်ဗူး",
    tags: ["Cold"],
  },
];

const serviceFees = {
  "dine-in": 0,
  takeaway: 0,
  delivery: 1500,
};

const modeLabels = {
  "dine-in": "ဆိုင်မှာစားမယ်",
  takeaway: "Pickup",
  delivery: "Delivery",
};

const categoryTabs = document.querySelector("#categoryTabs");
const menuList = document.querySelector("#menuList");
const searchInput = document.querySelector("#searchInput");
const cartItems = document.querySelector("#cartItems");
const subtotalText = document.querySelector("#subtotalText");
const serviceText = document.querySelector("#serviceText");
const totalText = document.querySelector("#totalText");
const orderForm = document.querySelector("#orderForm");
const formError = document.querySelector("#formError");
const locationLabel = document.querySelector("#locationLabel");
const addressField = document.querySelector(".address-field");
const orderBoard = document.querySelector("#orderBoard");
const toast = document.querySelector("#toast");
const ticketDialog = document.querySelector("#ticketDialog");
const ticketTitle = document.querySelector("#ticketTitle");
const ticketText = document.querySelector("#ticketText");

let selectedCategory = "All";
let orderMode = "dine-in";
let cart = new Map();
let lastTicket = "";

const money = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function formatMoney(value) {
  return `${money.format(value)} MMK`;
}

function getOrders() {
  try {
    return JSON.parse(localStorage.getItem("malartang-orders") || "[]");
  } catch {
    return [];
  }
}

function saveOrders(orders) {
  localStorage.setItem("malartang-orders", JSON.stringify(orders.slice(0, 40)));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function renderCategories() {
  const categories = ["All", ...new Set(menu.map((item) => item.category))];
  categoryTabs.innerHTML = categories
    .map(
      (category) => `
        <button class="${category === selectedCategory ? "is-active" : ""}" type="button" data-category="${category}">
          ${category}
        </button>
      `,
    )
    .join("");
}

function renderMenu() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleItems = menu.filter((item) => {
    const inCategory = selectedCategory === "All" || item.category === selectedCategory;
    const inSearch =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);
    return inCategory && inSearch;
  });

  if (!visibleItems.length) {
    menuList.innerHTML = `<p class="empty-cart">ရှာဖွေမှုနဲ့ကိုက်တဲ့ item မတွေ့ပါ။</p>`;
    return;
  }

  menuList.innerHTML = visibleItems
    .map(
      (item) => `
        <article class="menu-card">
          <div>
            <h3>${item.name}</h3>
            <p>${item.description}</p>
            <div class="item-meta">
              ${item.tags.map((tag) => `<span class="pill">${tag}</span>`).join("")}
            </div>
          </div>
          <div class="price-action">
            <span class="price">${formatMoney(item.price)}</span>
            <button class="add-button" type="button" data-add="${item.id}" aria-label="${item.name} ထည့်ရန်">+</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function calculateTotals() {
  const subtotal = [...cart.values()].reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  const service = cart.size ? serviceFees[orderMode] : 0;
  return {
    subtotal,
    service,
    total: subtotal + service,
  };
}

function renderCart() {
  if (!cart.size) {
    cartItems.className = "cart-items empty-cart";
    cartItems.innerHTML = "<p>Menu ထဲက item တွေကိုရွေးပြီး order စတင်ပါ။</p>";
  } else {
    cartItems.className = "cart-items";
    cartItems.innerHTML = [...cart.values()]
      .map(
        ({ item, quantity }) => `
          <div class="cart-line">
            <div>
              <strong>${item.name}</strong>
              <small>${formatMoney(item.price)} × ${quantity}</small>
            </div>
            <div class="quantity-control" aria-label="${item.name} quantity">
              <button type="button" data-decrease="${item.id}" aria-label="${item.name} လျှော့ရန်">−</button>
              <span>${quantity}</span>
              <button type="button" data-increase="${item.id}" aria-label="${item.name} တိုးရန်">+</button>
            </div>
          </div>
        `,
      )
      .join("");
  }

  const totals = calculateTotals();
  subtotalText.textContent = formatMoney(totals.subtotal);
  serviceText.textContent = formatMoney(totals.service);
  totalText.textContent = formatMoney(totals.total);
}

function addItem(itemId) {
  const item = menu.find((entry) => entry.id === itemId);
  if (!item) return;
  const current = cart.get(itemId);
  cart.set(itemId, { item, quantity: current ? current.quantity + 1 : 1 });
  renderCart();
  showToast(`${item.name} ထည့်ပြီးပါပြီ`);
}

function changeQuantity(itemId, amount) {
  const current = cart.get(itemId);
  if (!current) return;
  const nextQuantity = current.quantity + amount;
  if (nextQuantity <= 0) {
    cart.delete(itemId);
  } else {
    cart.set(itemId, { ...current, quantity: nextQuantity });
  }
  renderCart();
}

function setMode(mode) {
  orderMode = mode;
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });

  if (mode === "dine-in") {
    locationLabel.textContent = "စားပွဲနံပါတ်";
    orderForm.elements.location.placeholder = "ဥပမာ T-05";
    addressField.hidden = true;
  } else if (mode === "takeaway") {
    locationLabel.textContent = "လာယူမည့်အချိန်";
    orderForm.elements.location.placeholder = "ဥပမာ 6:30 PM";
    addressField.hidden = true;
  } else {
    locationLabel.textContent = "Delivery အချိန်";
    orderForm.elements.location.placeholder = "ဥပမာ 7:00 PM";
    addressField.hidden = false;
  }

  renderCart();
}

function validateOrder(formData) {
  if (!cart.size) return "အနည်းဆုံး item တစ်ခုရွေးပါ။";
  if (orderMode === "dine-in" && !formData.get("location").trim()) return "စားပွဲနံပါတ်ထည့်ပါ။";
  if (orderMode !== "dine-in" && !formData.get("customerName").trim()) return "နာမည်ထည့်ပါ။";
  if (orderMode !== "dine-in" && !formData.get("phone").trim()) return "ဖုန်းနံပါတ်ထည့်ပါ။";
  if (orderMode === "delivery" && !formData.get("address").trim()) return "Delivery လိပ်စာထည့်ပါ။";
  return "";
}

function buildOrder(formData) {
  const totals = calculateTotals();
  return {
    id: `MLT-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    mode: orderMode,
    broth: formData.get("broth"),
    spice: formData.get("spice"),
    payment: formData.get("payment"),
    location: formData.get("location").trim(),
    customerName: formData.get("customerName").trim(),
    phone: formData.get("phone").trim(),
    address: formData.get("address").trim(),
    note: formData.get("note").trim(),
    items: [...cart.values()].map(({ item, quantity }) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity,
      total: item.price * quantity,
    })),
    ...totals,
  };
}

function buildTicket(order) {
  const date = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(order.createdAt));

  const lines = [
    "MALARTANG ORDER",
    `Order: ${order.id}`,
    `Time: ${date}`,
    `Type: ${modeLabels[order.mode]}`,
    `Broth: ${order.broth}`,
    `Spice: ${order.spice}`,
    `Payment: ${order.payment}`,
    order.location ? `Table / Time: ${order.location}` : "",
    order.customerName ? `Name: ${order.customerName}` : "",
    order.phone ? `Phone: ${order.phone}` : "",
    order.address ? `Address: ${order.address}` : "",
    "",
    "ITEMS",
    ...order.items.map((item) => `- ${item.name} x${item.quantity} = ${formatMoney(item.total)}`),
    "",
    `Subtotal: ${formatMoney(order.subtotal)}`,
    `Service: ${formatMoney(order.service)}`,
    `Total: ${formatMoney(order.total)}`,
    order.note ? "" : "",
    order.note ? `Note: ${order.note}` : "",
  ];

  return lines.filter(Boolean).join("\n");
}

function openTicket(order) {
  lastTicket = buildTicket(order);
  ticketTitle.textContent = `${order.id} • ${formatMoney(order.total)}`;
  ticketText.textContent = lastTicket;
  if (typeof ticketDialog.showModal === "function") {
    ticketDialog.showModal();
  } else {
    alert(lastTicket);
  }
}

function renderOrders() {
  const orders = getOrders();
  if (!orders.length) {
    orderBoard.innerHTML = `<p class="empty-cart">ဒီ browser ထဲမှာ order မရှိသေးပါ။</p>`;
    return;
  }

  orderBoard.innerHTML = orders
    .slice(0, 9)
    .map(
      (order) => `
        <article class="order-card">
          <header>
            <strong>${order.id}</strong>
            <span>${formatMoney(order.total)}</span>
          </header>
          <p>${modeLabels[order.mode]} • ${order.spice}</p>
          <p>${order.items.length} item${order.items.length > 1 ? "s" : ""} • ${new Date(order.createdAt).toLocaleString()}</p>
          <button class="ghost-button" type="button" data-view-order="${order.id}">Ticket ကြည့်မယ်</button>
        </article>
      `,
    )
    .join("");
}

function submitOrder(event) {
  event.preventDefault();
  formError.textContent = "";

  const formData = new FormData(orderForm);
  const error = validateOrder(formData);
  if (error) {
    formError.textContent = error;
    return;
  }

  const order = buildOrder(formData);
  const orders = [order, ...getOrders()];
  saveOrders(orders);
  cart = new Map();
  orderForm.reset();
  setMode(orderMode);
  renderCart();
  renderOrders();
  openTicket(order);
}

async function copyTicket() {
  if (!lastTicket) return;
  await navigator.clipboard.writeText(lastTicket);
  showToast("Order ticket ကို copy လုပ်ပြီးပါပြီ");
}

async function shareTicket() {
  if (!lastTicket) return;
  if (navigator.share) {
    await navigator.share({
      title: "Malartang order",
      text: lastTicket,
    });
  } else {
    await copyTicket();
  }
}

function exportOrders() {
  const orders = getOrders();
  if (!orders.length) {
    showToast("Export လုပ်ရန် order မရှိသေးပါ");
    return;
  }

  const header = ["id", "createdAt", "mode", "customerName", "phone", "total", "items"];
  const rows = orders.map((order) => [
    order.id,
    order.createdAt,
    modeLabels[order.mode],
    order.customerName,
    order.phone,
    order.total,
    order.items.map((item) => `${item.name} x${item.quantity}`).join("; "),
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `malartang-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

categoryTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  renderCategories();
  renderMenu();
});

menuList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (button) addItem(button.dataset.add);
});

cartItems.addEventListener("click", (event) => {
  const increase = event.target.closest("[data-increase]");
  const decrease = event.target.closest("[data-decrease]");
  if (increase) changeQuantity(increase.dataset.increase, 1);
  if (decrease) changeQuantity(decrease.dataset.decrease, -1);
});

document.querySelectorAll(".mode-button").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

orderBoard.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view-order]");
  if (!button) return;
  const order = getOrders().find((entry) => entry.id === button.dataset.viewOrder);
  if (order) openTicket(order);
});

searchInput.addEventListener("input", renderMenu);
orderForm.addEventListener("submit", submitOrder);
document.querySelector("#clearCartButton").addEventListener("click", () => {
  cart = new Map();
  renderCart();
});
document.querySelector("#closeDialogButton").addEventListener("click", () => ticketDialog.close());
document.querySelector("#copyTicketButton").addEventListener("click", () => copyTicket().catch(() => showToast("Copy မအောင်မြင်ပါ")));
document.querySelector("#shareTicketButton").addEventListener("click", () => shareTicket().catch(() => showToast("Share မလုပ်နိုင်ပါ")));
document.querySelector("#printTicketButton").addEventListener("click", () => window.print());
document.querySelector("#exportOrdersButton").addEventListener("click", exportOrders);

renderCategories();
renderMenu();
renderCart();
renderOrders();
