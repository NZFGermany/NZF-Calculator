"use strict";
(() => {
  // bin/live-reload.js
  new EventSource(`${"http://localhost:3000"}/esbuild`).addEventListener("change", () => location.reload());

  // src/index.ts
  var init = async () => {
    let isSepaPayment = true;
    let isCardPayment = false;
    let isPaypalPayment = false;
    const stripe = window.Stripe?.("pk_live_51MUeTFF12CvoVfz6wzmgcT8vrtT83Gx34XXlvFm9o9zLAvx878EairjzbvUsy58PqLFBlYOvwc9o5qIhKtopBw3i00EZrJmX63");
    if (!stripe)
      return;
    const form = document.querySelector('[data-element="payment_form"]');
    if (!form)
      return;
    const ccStripeElement = document.querySelector('[data-element="cc_stripe"]');
    if (!ccStripeElement)
      return;
    const sepaStripeElement = document.querySelector('[data-element="sepa_stripe"]');
    if (!sepaStripeElement)
      return;
    const paypalStripeElement = document.querySelector('[data-element="paypal_stripe"]');
    if (!paypalStripeElement)
      return;
    const elements = stripe.elements();
    const sepaDebit = elements.create("iban", {
      supportedCountries: ["SEPA"],
      placeholderCountry: "DE",
      style: {
        base: {
          iconColor: "#000",
          backgroundColor: "#17535B",
          border: "1px solid #fff",
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
    sepaDebit.mount(sepaStripeElement);
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
        if (dataElement === "sepa_button") {
          isSepaPayment = true;
          isCardPayment = false;
          isPaypalPayment = false;
        } else if (dataElement === "card_button") {
          isCardPayment = true;
          isSepaPayment = false;
          isPaypalPayment = false;
        } else if (dataElement === "paypal_button") {
          isCardPayment = false;
          isSepaPayment = false;
          isPaypalPayment = true;
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
      var buttonText = document.querySelector(".button-text");
      if (buttonText instanceof HTMLElement) {
        buttonText.innerText = "Verarbeitung...";
      }
      let correctStripeAmount = amountNumber * 100;
      if (isPaypalPayment) {
        await handlePayPalPayment(correctStripeAmount);
      } else {
        const payment_intent = await createPaymentIntent(correctStripeAmount);
        if (!payment_intent)
          return;
        await elements.submit();
        const isSadakaPayment = payment_intent.isSadakaPayment ? payment_intent.isSadakaPayment : false;
        console.log(payment_intent);
        let userData = sessionStorage.getItem("userslowlane");
        let userdataclean = userData ? JSON.parse(userData) : {};
        userdataclean.paymentIntent_id = payment_intent.paymentIntent_id;
        sessionStorage.setItem("userslowlane", JSON.stringify(userdataclean));
        localStorage.removeItem("user");
        const currentTime = /* @__PURE__ */ new Date();
        const userObject = {
          ...userdataclean,
          timestamp: currentTime.getTime(),
          readableTime: currentTime.toString()
        };
        localStorage.setItem("user", JSON.stringify(userObject));
        let zakatBedrag = parseFloat(userdataclean.zakatPay) || 0;
        let ribaBedrag = parseFloat(userdataclean.ribaValue) || 0;
        let sadaqahBedrag = parseFloat(userdataclean.sadakaValue) || 0;
        let hoogsteBedrag = Math.max(zakatBedrag, ribaBedrag, sadaqahBedrag);
        let paymentType;
        if (hoogsteBedrag === zakatBedrag) {
          paymentType = "zakat";
        } else if (hoogsteBedrag === ribaBedrag) {
          paymentType = "riba";
        } else {
          paymentType = "sadaka";
        }
        if (payment_intent.isMonthly) {
          window.location.replace(payment_intent.paymentUrl);
          return;
        } else if (isSepaPayment) {
          processSepaPayment(stripe, sepaDebit, payment_intent, userdataclean, paymentType);
        } else if (isCardPayment) {
          processCardPayment(stripe, card, payment_intent, userdataclean, paymentType);
        }
      }
    });
  };
  var handlePayPalPayment = async (amount) => {
    try {
      let userslowlaneRawData = sessionStorage.getItem("userslowlane");
      let userslowlaneData = userslowlaneRawData ? JSON.parse(userslowlaneRawData) : {};
      const userTypeTranslations = {
        "ondernemer": "Unternehmer",
        "particulier": "Privatperson"
      };
      const keyMappings = {
        zakatPay: "ZakatBetrag",
        sadakaValue: "SadaqahBetrag",
        ribaValue: "ZinsBetrag",
        total: "Gesamtbetrag",
        anoniem: "Anonym",
        transactiekosten: "Transaktionkosten",
        datum: "Zahlungsdatum",
        fastlane: "Fastlane Benutzer",
        userType: "Type Zakat Zahler",
        userslowlane: "Slowlane Benutzer",
        educatiefonds: "Bildungsfonds",
        noodfonds: "Notfallfonds",
        woonfonds: "Wohnfonds",
        maandelijks: "Monatlich",
        voornaam: "Vorname",
        achternaam: "Nachname",
        email: "Email",
        stad: "Stadt",
        straat: "Stra\xDFe + Hausnummer",
        postcode: "Postleizahl"
      };
      if (userslowlaneData.anoniem) {
        delete keyMappings.voornaam;
        delete keyMappings.achternaam;
        delete keyMappings.email;
      }
      const filteredAndRenamedData = Object.keys(userslowlaneData).filter((key) => Object.keys(keyMappings).includes(key)).reduce((obj, key) => {
        const newKey = keyMappings[key] || key;
        if (key === "userType" && userTypeTranslations[userslowlaneData[key]]) {
          obj[newKey] = userTypeTranslations[userslowlaneData[key]];
        } else {
          obj[newKey] = userslowlaneData[key];
        }
        return obj;
      }, {});
      let zakatBedrag = parseFloat(userslowlaneData.zakatPay) || 0;
      let ribaBedrag = parseFloat(userslowlaneData.ribaValue) || 0;
      let sadaqahBedrag = parseFloat(userslowlaneData.sadakaValue) || 0;
      let hoogsteBedrag = Math.max(zakatBedrag, ribaBedrag, sadaqahBedrag);
      let paymentType;
      if (hoogsteBedrag === zakatBedrag) {
        paymentType = "zakat";
      } else if (hoogsteBedrag === ribaBedrag) {
        paymentType = "riba";
      } else {
        paymentType = "sadaka";
      }
      const response = await fetch("https://nzf-stripe.toufik.workers.dev/create-paypal-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount,
          currency: "eur",
          paymentType,
          userslowlaneData: JSON.stringify(filteredAndRenamedData)
        })
      });
      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }
      const data = await response.json();
      console.log("PayPal payment data:", data);
      const currentTime = /* @__PURE__ */ new Date();
      const userObject = {
        ...userslowlaneData,
        paymentIntentId: data.paymentIntentId,
        timestamp: currentTime.getTime(),
        readableTime: currentTime.toString(),
        paymentMethod: "paypal"
      };
      localStorage.setItem("user", JSON.stringify(userObject));
      if (data.clientSecret) {
        const stripe = window.Stripe?.("pk_live_51MUeTFF12CvoVfz6wzmgcT8vrtT83Gx34XXlvFm9o9zLAvx878EairjzbvUsy58PqLFBlYOvwc9o5qIhKtopBw3i00EZrJmX63");
        if (!stripe)
          throw new Error("Stripe not initialized");
        const result = await stripe.confirmPayPalPayment(
          data.clientSecret,
          {
            payment_method: {
              paypal: {},
              billing_details: {
                name: userslowlaneData.voornaam + " " + userslowlaneData.achternaam || "Unknown Name",
                email: userslowlaneData.email || "unknown@example.com",
                address: {
                  line1: userslowlaneData.straat || "Unknown Street",
                  postal_code: userslowlaneData.postcode || "00000",
                  city: userslowlaneData.stad || "Unknown City"
                }
              }
            },
            return_url: `https://nationaal-zakat-fonds-de.webflow.io/zahlung?paymentType=${paymentType}&paymentSort=paypal`
          }
        );
        if (result.error) {
          throw new Error(result.error.message || "PayPal payment failed");
        }
      } else {
        throw new Error("No client secret returned from server");
      }
    } catch (err) {
      console.error("PayPal payment error:", err);
      var buttonText = document.querySelector(".button-text");
      if (buttonText instanceof HTMLElement) {
        buttonText.innerText = "Zur Zahlung";
      }
      var existingFailedMessage = document.querySelector(".failed-message");
      if (existingFailedMessage && existingFailedMessage.parentNode) {
        existingFailedMessage.parentNode.removeChild(existingFailedMessage);
      }
      var failedMessage = document.createElement("div");
      failedMessage.classList.add("failed-message");
      failedMessage.textContent = "Bei der PayPal-Zahlung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder w\xE4hlen Sie eine andere Zahlungsmethode.";
      failedMessage.style.color = "red";
      var referenceDiv = document.querySelector(".impact-tabs-menu.w-tab-menu");
      if (referenceDiv && referenceDiv.parentNode) {
        referenceDiv.parentNode.insertBefore(failedMessage, referenceDiv);
      } else {
        console.error("Element or parent of .impact-tabs-menu.w-tab-menu not found");
      }
    }
  };
  var processSepaPayment = async (stripe, sepaDebit, payment_intent, userdataclean, paymentType) => {
    const translateStripeError = (error) => {
      switch (error) {
        case "Your card has been declined.":
          return "Ihre Karte wurde abgelehnt.";
        case "Your card has insufficient funds.":
          return "Ihre Karte hat unzureichende Mittel.";
        case "Your card has expired.":
          return "Ihre Karte ist abgelaufen.";
        case "Your card's security code is incorrect.":
          return "Der Sicherheitscode Ihrer Karte ist falsch.";
        case "An error occurred while processing your card. Try again in a little bit.":
          return "Beim Verarbeiten Ihrer Karte ist ein Fehler aufgetreten. Versuchen Sie es in K\xFCrze erneut.";
        case "Your card number is invalid.":
          return "Ihre Kartennummer ist ung\xFCltig.";
        case "Your card was declined for making repeated attempts too frequently.":
          return "Ihre Karte wurde abgelehnt, weil zu oft wiederholte Versuche gemacht wurden.";
        default:
          return "Ein unbekannter Fehler ist aufgetreten.";
      }
    };
    const resultSepaPayment = await stripe.confirmSepaDebitPayment(payment_intent.clientSecret, {
      payment_method: {
        sepa_debit: sepaDebit,
        billing_details: {
          name: userdataclean.voornaam + " " + userdataclean.achternaam || "Unknown Name",
          email: userdataclean.email || "unknown@example.com",
          address: {
            line1: userdataclean.straat || "Unknown Street",
            postal_code: userdataclean.postcode || "00000",
            city: userdataclean.stad || "Unknown City"
          }
        }
      },
      return_url: `https://secure.zakat-deutschland.de/zahlung?paymentType=${paymentType}&paymentSort=sepa`
    });
    if (resultSepaPayment.error) {
      showPaymentError(translateStripeError(resultSepaPayment.error.message) || "Die Zahlung mit Ihrer SEPA-Bank ist fehlgeschlagen, bitte versuchen Sie es erneut.");
    } else {
      redirectToThankYouPage(paymentType);
    }
  };
  var processCardPayment = async (stripe, card, payment_intent, userdataclean, paymentType) => {
    const translateStripeError = (error) => {
      switch (error) {
        case "Your card has been declined.":
          return "Ihre Karte wurde abgelehnt.";
        case "Your card has insufficient funds.":
          return "Ihre Karte hat unzureichende Mittel.";
        case "Your card has expired.":
          return "Ihre Karte ist abgelaufen.";
        case "Your card's security code is incorrect.":
          return "Der Sicherheitscode Ihrer Karte ist falsch.";
        case "An error occurred while processing your card. Try again in a little bit.":
          return "Beim Verarbeiten Ihrer Karte ist ein Fehler aufgetreten. Versuchen Sie es in K\xFCrze erneut.";
        case "Your card number is invalid.":
          return "Ihre Kartennummer ist ung\xFCltig.";
        case "Your card was declined for making repeated attempts too frequently.":
          return "Ihre Karte wurde abgelehnt, weil zu oft wiederholte Versuche gemacht wurden.";
        default:
          return "Ein unbekannter Fehler ist aufgetreten.";
      }
    };
    const resultCardPayment = await stripe.confirmCardPayment(payment_intent.clientSecret, {
      payment_method: {
        card,
        billing_details: {
          name: userdataclean.voornaam + " " + userdataclean.achternaam || "Unknown Name",
          email: userdataclean.email || "unknown@example.com",
          address: {
            line1: userdataclean.straat || "Unknown Street",
            postal_code: userdataclean.postcode || "00000",
            city: userdataclean.stad || "Unknown City"
          }
        }
      },
      return_url: `https://secure.zakat-deutschland.de/zahlung?paymentType=${paymentType}&paymentSort=card`
    });
    if (resultCardPayment.error) {
      showPaymentError(translateStripeError(resultCardPayment.error.message) || "Die Zahlung mit Ihrer Kreditkarte ist fehlgeschlagen, bitte versuchen Sie es erneut.");
    } else {
      redirectToThankYouPage(paymentType);
    }
  };
  var showPaymentError = (errorMessage) => {
    var buttonText = document.querySelector(".button-text");
    if (buttonText instanceof HTMLElement) {
      buttonText.innerText = "Zur Zahlung";
    }
    var existingFailedMessage = document.querySelector(".failed-message");
    if (existingFailedMessage && existingFailedMessage.parentNode) {
      existingFailedMessage.parentNode.removeChild(existingFailedMessage);
    }
    var failedMessage = document.createElement("div");
    failedMessage.classList.add("failed-message");
    failedMessage.textContent = errorMessage;
    failedMessage.style.color = "red";
    var referenceDiv = document.querySelector(".impact-tabs-menu.w-tab-menu");
    if (referenceDiv && referenceDiv.parentNode) {
      referenceDiv.parentNode.insertBefore(failedMessage, referenceDiv);
    } else {
      console.error("Element or parent of .impact-tabs-menu.w-tab-menu not found");
    }
  };
  var redirectToThankYouPage = (paymentType) => {
    if (paymentType === "riba")
      window.location.replace(`https://secure.zakat-deutschland.de/danke-fuer-deine-riba`);
    else if (paymentType === "zakat")
      window.location.replace(`https://secure.zakat-deutschland.de/danke-fuer-deine-zakat`);
    else if (paymentType === "sadaka")
      window.location.replace(`https://secure.zakat-deutschland.de/danke-fuer-deine-sadaqah`);
    else
      window.location.replace(`https://secure.zakat-deutschland.de/danke-fuer-deine-sadaqah`);
  };
  var createPaymentIntent = async (amount) => {
    try {
      let userslowlaneRawData = sessionStorage.getItem("userslowlane");
      let userslowlaneData = userslowlaneRawData ? JSON.parse(userslowlaneRawData) : {};
      console.log(userslowlaneData);
      const userTypeTranslations = {
        "ondernemer": "Unternehmer",
        "particulier": "Privatperson"
      };
      const keyMappings = {
        zakatPay: "ZakatBetrag",
        sadakaValue: "SadaqahBetrag",
        ribaValue: "ZinsBetrag",
        total: "Gesamtbetrag",
        anoniem: "Anonym",
        transactiekosten: "Transaktionkosten",
        datum: "Zahlungsdatum",
        fastlane: "Fastlane Benutzer",
        userType: "Type Zakat Zahler",
        // Hernoemen naar Duits
        userslowlane: "Slowlane Benutzer",
        educatiefonds: "Bildungsfonds",
        noodfonds: "Notfallfonds",
        woonfonds: "Wohnfonds",
        maandelijks: "Monatlich",
        voornaam: "Vorname",
        achternaam: "Nachname",
        email: "Email",
        stad: "Stadt",
        straat: "Stra\xDFe + Hausnummer",
        postcode: "Postleizahl"
      };
      if (userslowlaneData.anoniem) {
        delete keyMappings.voornaam;
        delete keyMappings.achternaam;
        delete keyMappings.email;
      }
      const filteredAndRenamedData = Object.keys(userslowlaneData).filter((key) => Object.keys(keyMappings).includes(key)).reduce((obj, key) => {
        const newKey = keyMappings[key] || key;
        if (key === "userType" && userTypeTranslations[userslowlaneData[key]]) {
          obj[newKey] = userTypeTranslations[userslowlaneData[key]];
        } else {
          obj[newKey] = userslowlaneData[key];
        }
        return obj;
      }, {});
      console.log("userslowlaneData to be sent:", filteredAndRenamedData);
      const response = await fetch("https://nzf-stripe.toufik.workers.dev/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount,
          currency: "eur",
          userslowlaneData: JSON.stringify(filteredAndRenamedData)
        })
      });
      const data = await response.json();
      return data;
    } catch (err) {
      var buttonText = document.querySelector(".button-text");
      if (buttonText instanceof HTMLElement) {
        buttonText.innerText = "Zur Zahlung";
      }
      var existingFailedMessage = document.querySelector(".failed-message");
      if (existingFailedMessage && existingFailedMessage.parentNode) {
        existingFailedMessage.parentNode.removeChild(existingFailedMessage);
      }
      var failedMessage = document.createElement("div");
      failedMessage.classList.add("failed-message");
      failedMessage.textContent = "Es ist ein Fehler aufgetreten. Wenn das Problem weiterhin besteht, aktualisieren Sie die Seite oder \xFCberpr\xFCfen Sie Ihre Verbindung.";
      failedMessage.style.color = "red";
      var referenceDiv = document.querySelector(".impact-tabs-menu.w-tab-menu");
      if (referenceDiv && referenceDiv.parentNode) {
        referenceDiv.parentNode.insertBefore(failedMessage, referenceDiv);
      } else {
        console.error("Element or parent of .impact-tabs-menu.w-tab-menu not found");
      }
      return null;
    }
  };
  init();
})();
//# sourceMappingURL=index.js.map
