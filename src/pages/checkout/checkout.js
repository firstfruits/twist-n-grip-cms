// ── Constants ─────────────────────────────────────────────────────────────────
const CART_KEY = "checkout_cart";

// ── State ─────────────────────────────────────────────────────────────────────
let cartItems     = [];   // array of { id, title, description, image, price, quantity }
let stripe        = null;
let elements      = null;
let currentIntentId   = null;
let stripeInitialized = false;

// ── DOM References ────────────────────────────────────────────────────────────
let checkoutForm, proceedBtn, backBtn, submitBtn;
let stepsWrapper, progStep1, progStep2, progLine;
let totalPriceDisplay;

// ── Cart helpers ──────────────────────────────────────────────────────────────
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function cartGrandTotal(cart) {
  return cart.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
}

function cartTotalQty(cart) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

// ── Render order items in Step 1 ──────────────────────────────────────────────
function renderOrderItems() {
  cartItems = getCart();
  const list    = document.getElementById("order-items-list");
  const emptyEl = document.getElementById("empty-cart-notice");
  const total   = cartGrandTotal(cartItems);

  if (!list) return;

  // Clear existing rows (keep the empty-notice element)
  Array.from(list.children).forEach((child) => {
    if (child.id !== "empty-cart-notice") child.remove();
  });

  if (cartItems.length === 0) {
    if (emptyEl) emptyEl.style.display = "block";
    if (totalPriceDisplay) totalPriceDisplay.textContent = "$0.00";
    updateHiddenFields(cartItems, 0);
    syncRecap(cartItems, 0);
    return;
  }

  if (emptyEl) emptyEl.style.display = "none";

  cartItems.forEach((item, index) => {
    const lineTotal = (parseFloat(item.price) * item.quantity).toFixed(2);
    const row = document.createElement("div");
    row.className = "checkout-item-row";
    row.innerHTML = `
      <!-- Thumbnail -->
      <div class="co-item-thumb">
        <img
          src="${item.image}"
          alt="${item.title}"
          onerror="this.style.opacity='0'"
        />
      </div>

      <!-- Title + unit price -->
      <div class="co-item-info">
        <p class="co-item-title">${item.title}</p>
        <p class="co-item-unit">$${parseFloat(item.price).toFixed(2)} <span>each</span></p>
      </div>

      <!-- Qty stepper -->
      <div class="co-qty-wrap">
        <button class="co-qty-btn co-dec-btn" data-index="${index}" aria-label="Decrease">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12h14"/></svg>
        </button>
        <span class="co-qty-num">${item.quantity}</span>
        <button class="co-qty-btn co-inc-btn" data-index="${index}" aria-label="Increase">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </button>
      </div>

      <!-- Line total -->
      <div class="co-line-price">$${lineTotal}</div>
    `;
    list.appendChild(row);
  });

  // Bind controls
  list.querySelectorAll(".co-dec-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      const cart = getCart();
      if (cart[idx].quantity > 1) {
        cart[idx].quantity--;
      } else {
        cart.splice(idx, 1);
      }
      saveCart(cart);
      renderOrderItems();
    });
  });

  list.querySelectorAll(".co-inc-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      const cart = getCart();
      cart[idx].quantity++;
      saveCart(cart);
      renderOrderItems();
    });
  });

  if (totalPriceDisplay) totalPriceDisplay.textContent = `$${total.toFixed(2)}`;
  updateHiddenFields(cartItems, total);
  syncRecap(cartItems, total);
}

// ── Hidden form fields ────────────────────────────────────────────────────────
function updateHiddenFields(cart, total) {
  const hiddenCart  = document.getElementById("hidden-cart-items");
  const hiddenTotal = document.getElementById("hidden-total-price");
  if (hiddenCart)  hiddenCart.value  = JSON.stringify(cart);
  if (hiddenTotal) hiddenTotal.value = total.toFixed(2);
}

// ── Sync Step 2 recap ─────────────────────────────────────────────────────────
function syncRecap(cart, total) {
  const recapTotal      = document.getElementById("recap-total");
  const recapItemsCount = document.getElementById("recap-items-count");
  const recapList       = document.getElementById("recap-item-list");
  const buttonText      = document.getElementById("button-text");

  const totalQty = cartTotalQty(cart);
  if (recapTotal)      recapTotal.textContent      = `$${total.toFixed(2)}`;
  if (recapItemsCount) recapItemsCount.textContent = totalQty === 1 ? "1 item" : `${totalQty} items`;
  if (buttonText)      buttonText.textContent      = `Pay $${total.toFixed(2)}`;

  if (recapList) {
    recapList.innerHTML = "";
    cart.forEach((item) => {
      const el = document.createElement("div");
      el.className = "flex justify-between items-center text-sm text-white/80";
      el.innerHTML = `
        <span class="line-clamp-1 flex-1 mr-2">${item.title} × ${item.quantity}</span>
        <span class="font-semibold text-white shrink-0">$${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
      `;
      recapList.appendChild(el);
    });
  }
}

// ── Step Navigation ───────────────────────────────────────────────────────────
function goToStep2() {
  stepsWrapper.classList.add("step-2");

  progStep1.classList.remove("active");
  progStep1.classList.add("done");
  progLine.classList.add("done");
  progStep2.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goToStep1() {
  stepsWrapper.classList.remove("step-2");

  progStep2.classList.remove("active");
  progLine.classList.remove("done");
  progStep1.classList.remove("done");
  progStep1.classList.add("active");
}

// ── Stripe Init ───────────────────────────────────────────────────────────────
async function initializeStripe() {
  const container = document.getElementById("stripe-container");
  const pubKey    = container?.dataset.pubkey;

  if (!pubKey || !window.Stripe) {
    showMessage("Payment gateway could not be loaded. Please refresh.");
    return;
  }

  stripe = window.Stripe(pubKey);
  await createPaymentIntent();
}

async function createPaymentIntent() {
  const cart  = getCart();
  const total = cartGrandTotal(cart);

  const payload = {
    // Pass the cart so the API can compute the amount server-side
    product: {
      title:    cart.map((i) => `${i.title} ×${i.quantity}`).join(", "),
      price:    total,
      quantity: 1,
    },
    intentId: currentIntentId,
  };

  try {
    const response = await fetch("/api/stripe/create-payment-intent", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to initialize payment");
    }

    currentIntentId = data.id;

    const appearance = {
      theme:     "stripe",
      variables: {
        colorPrimary:    "#d4183d",
        colorBackground: "#ffffff",
        colorText:       "#30313d",
        fontFamily:      "Inter, sans-serif",
        spacingUnit:     "4px",
        borderRadius:    "8px",
      },
    };

    elements = stripe.elements({
      appearance,
      clientSecret: data.clientSecret,
    });

    const paymentElement = elements.create("payment", { layout: "tabs" });
    const paymentElementContainer = document.getElementById("payment-element");
    paymentElement.mount("#payment-element");

    paymentElement.on("ready", () => {
      document.getElementById("payment-loading").style.display = "none";
      paymentElementContainer.classList.remove("hidden");
      submitBtn.disabled = false;
      stripeInitialized  = true;
    });

  } catch (err) {
    document.getElementById("payment-loading").style.display = "none";
    showMessage("Payment initialization failed. " + err.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showMessage(text) {
  const el = document.getElementById("payment-message");
  if (!el) return;
  if (text) {
    el.classList.remove("hidden");
    el.textContent = text;
  } else {
    el.classList.add("hidden");
    el.textContent = "";
  }
}

function setLoading(isLoading) {
  const spinner    = document.getElementById("spinner");
  const buttonText = document.getElementById("button-text");

  submitBtn.disabled = isLoading;
  if (isLoading) {
    spinner.classList.remove("hidden");
    buttonText.classList.add("hidden");
    checkoutForm.classList.add("processing");
  } else {
    spinner.classList.add("hidden");
    buttonText.classList.remove("hidden");
    checkoutForm.classList.remove("processing");
  }
}

async function submitToNetlify(paymentIntentId, paymentStatus) {
  const cart  = getCart();
  const total = cartGrandTotal(cart).toFixed(2);
  const formData = new FormData(checkoutForm);

  formData.set("form-name",             "checkout");
  formData.set("stripe-transaction-id", paymentIntentId);
  formData.set("stripe-status",         paymentStatus);
  formData.set("cart-items",            JSON.stringify(cart));
  formData.set("total-price",           total);

  try {
    const response = await fetch("/checkout-form-stub.html", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams(formData).toString(),
    });

    if (!response.ok) {
      console.error("Netlify submission failed:", response.status);
    } else {
      console.log("Order submitted to Netlify Forms ✓");
    }
  } catch (err) {
    console.error("Netlify submission error:", err);
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
function initCheckout() {
  totalPriceDisplay = document.getElementById("total-price-display");
  checkoutForm      = document.getElementById("checkout-form");
  proceedBtn        = document.getElementById("proceed-to-payment");
  backBtn           = document.getElementById("back-to-step1");
  submitBtn         = document.getElementById("submit");
  stepsWrapper      = document.getElementById("steps-wrapper");
  progStep1         = document.getElementById("prog-step-1");
  progStep2         = document.getElementById("prog-step-2");
  progLine          = document.getElementById("prog-line");

  // Render cart items
  renderOrderItems();

  // Proceed button
  proceedBtn?.addEventListener("click", async () => {
    const cart = getCart();
    if (cart.length === 0) {
      alert("Your cart is empty. Please add products before proceeding.");
      return;
    }
    if (!checkoutForm.checkValidity()) {
      checkoutForm.reportValidity();
      return;
    }
    goToStep2();
    if (!stripeInitialized) {
      await initializeStripe();
    }
  });

  // Back button
  backBtn?.addEventListener("click", () => {
    goToStep1();
  });

  // Pay Now button
  submitBtn?.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      showMessage("Payment gateway not loaded yet. Please wait.");
      return;
    }

    setLoading(true);
    showMessage("");

    const formData       = new FormData(checkoutForm);
    const billingDetails = {
      name:    formData.get("fullName"),
      email:   formData.get("email"),
      phone:   formData.get("phone"),
      address: {
        line1:       formData.get("address"),
        city:        formData.get("city"),
        postal_code: formData.get("postalCode"),
        country:     formData.get("country"),
      },
    };

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        payment_method_data: { billing_details: billingDetails },
        shipping: {
          name:    billingDetails.name,
          address: billingDetails.address,
        },
      },
      redirect: "if_required",
    });

    if (error) {
      const errorMsg =
        error.type === "card_error" || error.type === "validation_error"
          ? error.message
          : "An unexpected error occurred. Please try again.";
      const params = new URLSearchParams({ status: "failed", error: errorMsg });
      window.location.href = `/order-status?${params.toString()}`;
      setLoading(false);
    } else if (paymentIntent?.status === "succeeded") {
      showMessage("");
      await submitToNetlify(paymentIntent.id, paymentIntent.status);

      const cart  = getCart();
      const total = cartGrandTotal(cart).toFixed(2);
      const params = new URLSearchParams({
        status:  "success",
        product: cart.map((i) => `${i.title} ×${i.quantity}`).join(", "),
        qty:     String(cartTotalQty(cart)),
        total:   total,
        txn:     paymentIntent.id,
      });

      localStorage.removeItem(CART_KEY);
      window.location.href = `/order-status?${params.toString()}`;
    } else {
      showMessage("Payment is processing or requires additional action.");
      setLoading(false);
    }
  });

  // Prevent native form submit
  checkoutForm?.addEventListener("submit", (e) => e.preventDefault());
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCheckout);
  } else {
    initCheckout();
  }
}
