// ── DOM References ──────────────────────────────────────────────────────────
const quantityDisplay    = document.getElementById("quantity-display");
const totalPriceDisplay  = document.getElementById("total-price-display");
const decreaseBtn        = document.getElementById("decrease-qty");
const increaseBtn        = document.getElementById("increase-qty");
const checkoutForm       = document.getElementById("checkout-form");
const proceedBtn         = document.getElementById("proceed-to-payment");
const backBtn            = document.getElementById("back-to-step1");
const submitBtn          = document.getElementById("submit");
const stepsWrapper       = document.getElementById("steps-wrapper");
const progStep1          = document.getElementById("prog-step-1");
const progStep2          = document.getElementById("prog-step-2");
const progLine           = document.getElementById("prog-line");

// ── State ────────────────────────────────────────────────────────────────────
let productData     = null;
let currentQuantity = 1;
let stripe          = null;
let elements        = null;
let currentIntentId = null;
let stripeInitialized = false;  // guard – only create the intent once

// ── Product Loading ──────────────────────────────────────────────────────────
function loadProductData() {
  const storedData = localStorage.getItem("checkout_product");
  if (storedData) {
    productData     = JSON.parse(storedData);
    currentQuantity = productData.quantity || 1;

    // Fill visible text from stored data (JS overwrites Astro defaults)
    const nameEl  = document.querySelector("h3.text-lg");
    const descEl  = document.querySelector("p.text-sm.text-gray-500.mb-3");
    const priceEl = document.querySelector("p.text-xl.font-bold");
    const imgEl   = document.querySelector("img.object-contain");

    if (nameEl)  nameEl.textContent  = productData.title;
    if (descEl)  descEl.textContent  = productData.description;
    if (priceEl) priceEl.textContent = `$${parseFloat(productData.price).toFixed(2)}`;
    if (imgEl)  { imgEl.src = productData.image; imgEl.alt = productData.title; }
  } else {
    // Fallback: read static data embedded in the page via data attributes
    const container = document.getElementById("stripe-container");
    const fallbackPrice = parseFloat(container?.dataset.price || "0");
    const fallbackTitle = container?.dataset.title || "Product";
    productData = { title: fallbackTitle, price: fallbackPrice, quantity: 1 };
    console.warn("No product data in localStorage — using page defaults.");
  }
  updateDisplay();
}

// ── Display Sync ─────────────────────────────────────────────────────────────
function updateDisplay() {
  if (!productData) return;

  const price = parseFloat(productData.price);
  const total = (currentQuantity * price).toFixed(2);

  if (quantityDisplay)   quantityDisplay.textContent  = currentQuantity;
  if (totalPriceDisplay) totalPriceDisplay.textContent = `$${total}`;

  // Hidden form fields
  const hiddenName  = document.getElementById("hidden-product-name");
  const hiddenQty   = document.getElementById("hidden-product-qty");
  const hiddenTotal = document.getElementById("hidden-total-price");
  if (hiddenName)  hiddenName.value  = productData.title;
  if (hiddenQty)   hiddenQty.value   = currentQuantity;
  if (hiddenTotal) hiddenTotal.value = total;

  // Sync recap on Step 2
  const recapName  = document.getElementById("recap-name");
  const recapQty   = document.getElementById("recap-qty");
  const recapTotal = document.getElementById("recap-total");
  if (recapName)  recapName.textContent  = productData.title;
  if (recapQty)   recapQty.textContent   = currentQuantity;
  if (recapTotal) recapTotal.textContent = `$${total}`;

  // Update Pay button label with amount
  const buttonText = document.getElementById("button-text");
  if (buttonText) buttonText.textContent = `Pay $${total}`;

  productData.quantity = currentQuantity;
  localStorage.setItem("checkout_product", JSON.stringify(productData));
}

// ── Quantity Controls ─────────────────────────────────────────────────────────
decreaseBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  if (currentQuantity > 1) {
    currentQuantity--;
    updateDisplay();
  }
});

increaseBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  currentQuantity++;
  updateDisplay();
});

// ── Step Navigation ───────────────────────────────────────────────────────────
function goToStep2() {
  stepsWrapper.classList.add("step-2");

  // Progress bar
  progStep1.classList.remove("active");
  progStep1.classList.add("done");
  progLine.classList.add("done");
  progStep2.classList.add("active");

  // Lock quantity controls in Step 2
  decreaseBtn.disabled = true;
  increaseBtn.disabled = true;

  // Scroll to top so order recap + Stripe form are visible
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goToStep1() {
  stepsWrapper.classList.remove("step-2");

  // Progress bar
  progStep2.classList.remove("active");
  progLine.classList.remove("done");
  progStep1.classList.remove("done");
  progStep1.classList.add("active");

  // Unlock quantity controls
  decreaseBtn.disabled = false;
  increaseBtn.disabled = false;
}

// ── Proceed Button ────────────────────────────────────────────────────────────
proceedBtn?.addEventListener("click", async () => {
  // Validate shipping form first
  if (!checkoutForm.checkValidity()) {
    checkoutForm.reportValidity();
    return;
  }

  goToStep2();

  // Initialize Stripe only once
  if (!stripeInitialized) {
    await initializeStripe();
  }
});

// ── Back Button ────────────────────────────────────────────────────────────────
backBtn?.addEventListener("click", () => {
  goToStep1();
});

// ── Stripe Init (deferred, runs once) ────────────────────────────────────────
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
  if (!productData) return;

  const payload = {
    product:  { ...productData, quantity: currentQuantity },
    intentId: currentIntentId, // null on first call
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

    // When the element is ready, hide the skeleton and show the element
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

// ── Pay Now ────────────────────────────────────────────────────────────────────
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

    // Redirect to failure page
    const params = new URLSearchParams({ status: "failed", error: errorMsg });
    window.location.href = `/order-status?${params.toString()}`;
    setLoading(false);
  } else if (paymentIntent?.status === "succeeded") {
    showMessage("");
    await submitToNetlify(paymentIntent.id, paymentIntent.status);

    // Build redirect URL with order details
    const price = parseFloat(productData?.price || 0);
    const total = (currentQuantity * price).toFixed(2);
    const params = new URLSearchParams({
      status:  "success",
      product: productData?.title || "",
      qty:     currentQuantity,
      total:   total,
      txn:     paymentIntent.id,
    });

    localStorage.removeItem("checkout_product");
    window.location.href = `/order-status?${params.toString()}`;

  } else {
    showMessage("Payment is processing or requires additional action.");
    setLoading(false);
  }
});

// Prevent native form submit
checkoutForm?.addEventListener("submit", (e) => e.preventDefault());

// ── Helpers ────────────────────────────────────────────────────────────────────
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

function showToast() {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
}

async function submitToNetlify(paymentIntentId, paymentStatus) {
  const formData = new FormData(checkoutForm);
  formData.set("stripe-transaction-id", paymentIntentId);
  formData.set("stripe-status", paymentStatus);
  formData.set("form-name", "checkout");

  try {
    const response = await fetch(window.location.pathname, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams(formData).toString(),
    });

    if (!response.ok) {
      console.error("Netlify submission failed:", response.status);
    }
  } catch (err) {
    console.error("Netlify submission error:", err);
  }
}

// ── Boot ────────────────────────────────────────────────────────────────────────
function initCheckout() {
  loadProductData();
  // Stripe is NOT initialized here — only when user proceeds to Step 2
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCheckout);
} else {
  initCheckout();
}
