  const quantityDisplay = document.getElementById("quantity-display");
  const totalPriceDisplay = document.getElementById("total-price-display");
  const decreaseBtn = document.getElementById("decrease-qty");
  const increaseBtn = document.getElementById("increase-qty");
  const checkoutForm = document.getElementById("checkout-form");

  // Selection elements
  const productNameEl = document.querySelector("h3.text-lg.font-medium");
  const productDescEl = document.querySelector("p.text-gray-600.text-sm");
  const productPriceEl = document.querySelector("p.text-2xl.font-bold");
  const productImageEl = document.querySelector("img.object-contain");

  let productData = null;
  let currentQuantity = 1;
  let stripe;
  let elements;
  let currentIntentId = null;

  async function initializeStripe() {
    const container = document.getElementById("stripe-container");
    const pubKey = container?.dataset.pubkey;

    if (!pubKey || !window.Stripe) {
      console.error("Stripe could not be initialized. Missing key or SDK.");
      return;
    }

    stripe = window.Stripe(pubKey);

    await createOrUpdatePaymentIntent();
  }

  async function createOrUpdatePaymentIntent() {
    if (!productData) return;

    const payload = {
      product: { ...productData, quantity: currentQuantity },
      intentId: currentIntentId,
    };

    try {
      const response = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to initialize payment");
      }

      currentIntentId = data.id;
      const paymentElementContainer =
        document.getElementById("payment-element");
      if (elements) {
        paymentElementContainer.innerHTML = "";
      }

      const appearance = {
        theme: "stripe",
        variables: {
          colorPrimary: "#d4183d",
          colorBackground: "#ffffff",
          colorText: "#30313d",
          fontFamily: "Inter, sans-serif",
          spacingUnit: "4px",
          borderRadius: "8px",
        },
      };

      elements = stripe.elements({
        appearance,
        clientSecret: data.clientSecret,
      });

      const paymentElementOptions = {
        layout: "tabs",
      };

      const paymentElement = elements.create("payment", paymentElementOptions);
      paymentElement.mount("#payment-element");
    } catch (err) {
      showMessage("Payment initialization failed. " + err.message);
    }
  }

  function showMessage(messageText) {
    const messageContainer = document.querySelector("#payment-message");
    if (!messageContainer) return;

    if (messageText) {
      messageContainer.classList.remove("hidden");
      messageContainer.textContent = messageText;
    } else {
      messageContainer.classList.add("hidden");
      messageContainer.textContent = "";
    }
  }

  function setLoading(isLoading) {
    const submitBtn = document.querySelector("#submit");
    const spinner = document.querySelector("#spinner");
    const buttonText = document.querySelector("#button-text");
    const form = document.querySelector("#checkout-form");

    if (isLoading) {
      submitBtn.disabled = true;
      spinner.classList.remove("hidden");
      buttonText.classList.add("hidden");
      form.classList.add("processing");
    } else {
      submitBtn.disabled = false;
      spinner.classList.add("hidden");
      buttonText.classList.remove("hidden");
      form.classList.remove("processing");
    }
  }

  function loadProductData() {
    const storedData = localStorage.getItem("checkout_product");
    if (storedData) {
      productData = JSON.parse(storedData);
      currentQuantity = productData.quantity || 1;

      // Update UI with stored data
      if (productNameEl) productNameEl.textContent = productData.title;
      if (productDescEl) productDescEl.textContent = productData.description;
      if (productPriceEl)
        productPriceEl.textContent = `$${parseFloat(productData.price).toFixed(2)}`;
      if (productImageEl) {
        productImageEl.src = productData.image;
        productImageEl.alt = productData.title;
      }

      updateDisplay();
    } else {
      console.warn("No product data found in localStorage");
    }
  }

  function updateDisplay() {
    if (!productData) return;

    if (quantityDisplay) quantityDisplay.textContent = currentQuantity;
    if (totalPriceDisplay) {
      const price = parseFloat(productData.price);
      const total = (currentQuantity * price).toFixed(2);
      totalPriceDisplay.textContent = `$${total}`;

      // Update hidden form fields
      const hiddenName = document.getElementById("hidden-product-name");
      const hiddenQty = document.getElementById("hidden-product-qty");
      const hiddenTotal = document.getElementById("hidden-total-price");
      if (hiddenName) hiddenName.value = productData.title;
      if (hiddenQty) hiddenQty.value = currentQuantity;
      if (hiddenTotal) hiddenTotal.value = total;
    }

    // Sync back to localStorage
    productData.quantity = currentQuantity;
    localStorage.setItem("checkout_product", JSON.stringify(productData));
  }

  // Form Validation Logic
  function checkFormValidity() {
    return checkoutForm.checkValidity();
  }

  function showToast() {
    const toast = document.getElementById("toast");
    if (toast) {
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 3000);
    }
  }

  async function submitToNetlify(paymentIntentId, paymentStatus) {
    const formData = new FormData(checkoutForm);
    // Replace paypal fields with stripe fields
    formData.set("stripe-transaction-id", paymentIntentId);
    formData.set("stripe-status", paymentStatus);
    formData.set("form-name", "checkout");

    try {
      const response = await fetch(window.location.pathname, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData).toString(),
      });

      if (response.ok) {
        console.log("Form successfully submitted to Netlify");
      } else {
        console.error(
          "Netlify submission failed with status:",
          response.status,
        );
      }
    } catch (error) {
      console.error("Netlify submission error:", error);
    }
  }

  let updateTimeout;

  decreaseBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (currentQuantity > 1) {
      currentQuantity--;
      updateDisplay();

      // Debounce payment intent update
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(createOrUpdatePaymentIntent, 500);
    }
  });

  increaseBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    currentQuantity++;
    updateDisplay();

    // Debounce payment intent update
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(createOrUpdatePaymentIntent, 500);
  });

  const submitButton = document.getElementById("submit");

  submitButton?.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      showMessage("Payment gateway not loaded yet.");
      return;
    }

    if (!checkFormValidity()) {
      checkoutForm.reportValidity();
      return;
    }

    setLoading(true);
    showMessage("");

    // Gather shipping data from form fields to send to Stripe
    const formData = new FormData(checkoutForm);
    const billingDetails = {
      name: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      address: {
        line1: formData.get("address"),
        city: formData.get("city"),
        postal_code: formData.get("postalCode"),
        country: formData.get("country"), // In production, consider mapping this to ISO 2-letter codes
      },
    };

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        payment_method_data: {
          billing_details: billingDetails,
        },
        shipping: {
          name: billingDetails.name,
          address: billingDetails.address,
        },
      },
      redirect: "if_required", // stays on page if authentication succeeds
    });

    if (error) {
      // Show error to customer
      if (error.type === "card_error" || error.type === "validation_error") {
        showMessage(error.message);
      } else {
        showMessage("An unexpected error occurred.");
      }
      setLoading(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      // Payment Successful!
      showMessage("");

      // Submit order details to Netlify CMS
      await submitToNetlify(paymentIntent.id, paymentIntent.status);

      showToast();

      // Clear cart/checkout product
      localStorage.removeItem("checkout_product");

      // Redirect to home after delay
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } else {
      showMessage("Payment is processing or requires your action.");
      setLoading(false);
    }
  });

  checkoutForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    // Use the custom click handler on the button instead
  });

  // Initial load
  function initCheckout() {
    loadProductData();
    initializeStripe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckout);
  } else {
    initCheckout();
  }
