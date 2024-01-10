"use strict";
(() => {
  // bin/live-reload.js
  new EventSource(`${"http://localhost:3000"}/esbuild`).addEventListener("change", () => location.reload());

  // src/index.ts
  var init = async () => {
    let isIdealPayment = true;
    let isCardPayment = false;
    const stripe = window.Stripe?.("pk_test_51OJjQxA8yQevovoJTjCBQdN1tLAHzrQ82wfGZymhr0fHRF0KH5U4ljIRcs9ZZMipzP7Bqabz7gEnj2g9IbfWcWeF0009IpfcQY");
    if (!stripe)
      return;
    const form = document.querySelector('[data-element="payment_form"]');
    if (!form)
      return;
    const ccStripeElement = document.querySelector('[data-element="cc_stripe"]');
    if (!ccStripeElement)
      return;
    const idealStripeElement = document.querySelector('[data-element="ideal_stripe"]');
    if (!idealStripeElement)
      return;
    const elements = stripe.elements();
    const idealBank = elements.create("idealBank", {
      style: {
        base: {
          iconColor: "#000",
          backgroundColor: "#17535B",
          border: "1px",
          borderColor: "#fff",
          padding: "20px",
          color: "#fff",
          borderRadius: "4px",
          fontWeight: "500",
          fontFamily: "Ekster, sans-serif, Inter, Open Sans, Segoe UI, sans-serif",
          fontSize: "16px",
          fontSmoothing: "antialiased",
          ":-webkit-autofill": {
            color: "#fff"
          },
          "::placeholder": {
            color: "#fff"
          }
        },
        invalid: {
          iconColor: "#fff",
          color: "#fff"
        }
      }
    });
    idealBank.mount(idealStripeElement);
    const card = elements.create("card", {
      style: {
        base: {
          backgroundColor: "#17535B",
          border: "1px",
          padding: "20px",
          borderColor: "#fff",
          color: "#fff",
          iconColor: "#fff",
          fontWeight: 500,
          fontFamily: "Ekster, sans-serif, Inter, Open Sans, Segoe UI, sans-serif",
          fontSize: "16px",
          fontSmoothing: "antialiased",
          "::placeholder": {
            color: "#fff"
          }
        },
        invalid: {
          iconColor: "#fff",
          color: "#E25950"
        }
      }
    });
    card.mount(ccStripeElement);
    var tabs = document.querySelectorAll(".w-tab-link");
    tabs.forEach(function(tab) {
      tab.addEventListener("click", function(event) {
        event.preventDefault();
        var dataElement = tab.getAttribute("data-element");
        if (dataElement === "ideal_button") {
          isIdealPayment = true;
          isCardPayment = false;
        } else if (dataElement === "card_button") {
          isCardPayment = true;
          isIdealPayment = false;
        }
      });
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const amountStripeElement = document.querySelector('[data-element="price_amount"]');
      let amountNumber = parseFloat(String(amountStripeElement?.value)) ?? 0;
      if (!amountStripeElement || isNaN(amountNumber)) {
        return;
      }
      let correctStripeAmount = amountNumber * 100;
      const payment_intent = await createPaymentIntent(correctStripeAmount);
      if (!payment_intent)
        return;
      await elements.submit();
      const isSadakaPayment = payment_intent.isSadakaPayment ? payment_intent.isSadakaPayment : false;
      console.log(payment_intent);
      let paymentType;
      if (payment_intent.isZakaatPayment && payment_intent.isRibaPayment) {
        paymentType = "zakaat";
      } else if (payment_intent.isRibaPayment && !payment_intent.isZakaatPayment) {
        paymentType = "riba";
      } else if (payment_intent.isSadakaPayment) {
        paymentType = "sadaka";
      } else {
        paymentType = "zakaat";
      }
      if (payment_intent.isMonthly) {
        window.location.replace(payment_intent.paymentUrl);
      } else if (isIdealPayment) {
        const resultIdealPayment = await stripe.confirmIdealPayment(payment_intent.clientSecret, {
          payment_method: {
            ideal: idealBank
          },
          return_url: `https://nationaal-zakat-fonds-rekenmachine.webflow.io/gegevens?paymentType=${paymentType}&paymentSort=ideal`
        });
      } else if (isCardPayment) {
        const resultCardPayment = await stripe.confirmCardPayment(payment_intent.clientSecret, {
          payment_method: {
            card
          },
          return_url: `https://nationaal-zakat-fonds-rekenmachine.webflow.io/gegevens?paymentType=${paymentType}&paymentSort=card`
        });
        if (resultCardPayment.error) {
          var existingFailedMessage = document.querySelector(".failed-message");
          if (existingFailedMessage && existingFailedMessage.parentNode) {
            existingFailedMessage.parentNode.removeChild(existingFailedMessage);
          }
          var failedMessage = document.createElement("div");
          failedMessage.classList.add("failed-message");
          failedMessage.textContent = resultCardPayment.error?.message || "De betaling met uw Creditcard is niet gelukt, probeer het opnieuw.";
          failedMessage.style.color = "red";
          var referenceDiv = document.querySelector(".impact-tabs-menu.w-tab-menu");
          if (referenceDiv && referenceDiv.parentNode) {
            referenceDiv.parentNode.insertBefore(failedMessage, referenceDiv);
          } else {
            console.error("Element or parent of .impact-tabs-menu.w-tab-menu not found");
          }
        } else {
          if (paymentType === "riba")
            window.location.replace(`https://nationaal-zakat-fonds-rekenmachine.webflow.io/bedankt-riba`);
          else if (paymentType === "zakaat")
            window.location.replace(`https://nationaal-zakat-fonds-rekenmachine.webflow.io/bedankt-zakaat`);
          else if (paymentType === "sadaka")
            window.location.replace(`https://nationaal-zakat-fonds-rekenmachine.webflow.io/bedankt-sadaqa`);
          else
            window.location.replace(`https://nationaal-zakat-fonds-rekenmachine.webflow.io/bedankt-sadaqa`);
        }
      }
    });
  };
  var createPaymentIntent = async (amount) => {
    try {
      let userslowlaneData = sessionStorage.getItem("userslowlane");
      const response = await fetch("http://https://cloudflare-work.jabirtisou8072.workers.dev/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount,
          currency: "eur",
          userslowlaneData
        })
      });
      const data = await response.json();
      return data;
    } catch (err) {
      return null;
    }
  };
  init();
})();
//# sourceMappingURL=index.js.map
