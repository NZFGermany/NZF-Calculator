declare const STRIPE_KEY: string;

const init = async () => {
    let isIdealPayment = true;
    let isCardPayment = false;

    const translateStripeError = (error) => {
        switch (error) {
            case 'Your card has been declined.':
                return 'Uw kaart is geweigerd.';
            case 'Your card has insufficient funds.':
                return 'Uw kaart heeft onvoldoende saldo.';
            case 'Your card has expired.':
                return 'Uw kaart is verlopen.';
            case 'Your card\'s security code is incorrect.':
                return 'De beveiligingscode van uw kaart is onjuist.';
            case 'An error occurred while processing your card. Try again in a little bit.':
                return 'Er is een fout opgetreden bij het verwerken van uw kaart. Probeer het over een poosje opnieuw.';
            case 'Your card number is invalid.':
                return 'Uw kaartnummer is ongeldig.';
            case 'Your card was declined for making repeated attempts too frequently.':
                return 'Uw kaart is geweigerd vanwege het te vaak herhalen van pogingen.';
            default:
                return 'Er is een onbekende fout opgetreden.';
        }
    };
    
    const stripe = window.Stripe?.(STRIPE_KEY);
    if (!stripe) return;

    const form = document.querySelector<HTMLFormElement>('[data-element="payment_form"]');
    if (!form) return;

    const ccStripeElement = document.querySelector<HTMLElement>('[data-element="cc_stripe"]');
    if (!ccStripeElement) return;

    const idealStripeElement = document.querySelector<HTMLElement>('[data-element="ideal_stripe"]');
    if (!idealStripeElement) return;
    

    const elements = stripe.elements();

    // styling of elements check here properties: https://stripe.com/docs/js/appendix/style
    const idealBank = elements.create('idealBank', {
    style: {
        base: {
        iconColor: '#000',
        backgroundColor: '#17535B',
        border: '1px',
        borderColor: '#fff',
        padding: '20px',
        color: '#fff',
        borderRadius: '4px',
        fontWeight: '500',
        fontFamily: "Ekster, sans-serif, Inter, Open Sans, Segoe UI, sans-serif",
        fontSize: '16px',
        fontSmoothing: 'antialiased',
        ':-webkit-autofill': {
            color: '#fff',
        },
        '::placeholder': {
            color: '#fff',
        },
        },
        invalid: {
        iconColor: '#fff',
        color: '#fff',
        },
    },
    });
    idealBank.mount(idealStripeElement);

    const card = elements.create('card', {
     style: {
      base: {
        backgroundColor: '#17535B',
        border: '1px',
        padding: '20px',
        borderColor: '#fff',
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
        iconColor: '#fff',
        color: "#E25950"
      }
    }
  });
    card.mount(ccStripeElement);

    // Get all tab elements
    var tabs = document.querySelectorAll('.w-tab-link');

    // Add click event listeners to each tab
    tabs.forEach(function(tab) {
    tab.addEventListener('click', function(event) {
        // Prevent the default link behavior
        event.preventDefault();

        // Get the data-element attribute value
        var dataElement = tab.getAttribute('data-element');

        // Check if the clicked tab has a specific data-element value
        if (dataElement === 'ideal_button') {
            isIdealPayment = true;
            isCardPayment = false;
        } else if (dataElement === 'card_button') {
            isCardPayment = true;
            isIdealPayment = false;
        }
      });
    });

     idealBank.on("change", (event: any) => {
        const button = document.querySelector('.button-slider-next') as HTMLAnchorElement;
        button.classList.remove('is-disabled');
    });
   

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const amountStripeElement = document.querySelector<HTMLInputElement>('[data-element="price_amount"]');
        let amountNumber = parseFloat(String(amountStripeElement?.value)) ?? 0;
        
        if (!amountStripeElement || isNaN(amountNumber)) {
            return;
        }

        // amountNumber * 100 because stripe does the input price / 100
        let correctStripeAmount = amountNumber * 100;
        const payment_intent = await createPaymentIntent(correctStripeAmount);
        if (!payment_intent) return;

        await elements.submit()

        const isSadakaPayment = payment_intent.isSadakaPayment ? payment_intent.isSadakaPayment : false;
        console.log(payment_intent)
        let paymentType;

        if(payment_intent.isZakaatPayment && payment_intent.isRibaPayment){
            paymentType = 'zakaat'
        } else if(payment_intent.isRibaPayment && !payment_intent.isZakaatPayment) {
            paymentType = 'riba'
        } else if(payment_intent.isSadakaPayment){
            paymentType = 'sadaka'
        }else{
            paymentType = 'zakaat'
        }
        
        if(payment_intent.isMonthly){
           window.location.replace(payment_intent.paymentUrl)
        } else if(isIdealPayment){
            const resultIdealPayment = await stripe.confirmIdealPayment(payment_intent.clientSecret ,{
                payment_method: {
                    ideal: idealBank
                },
                return_url: `https://nationaal-zakat-fonds-rekenmachine.webflow.io/gegevens?paymentType=${paymentType}&paymentSort=ideal`,
            })
        } else if(isCardPayment){
            const resultCardPayment = await stripe.confirmCardPayment(payment_intent.clientSecret, {
            payment_method: {
                    card: card
                },
                return_url: `https://nationaal-zakat-fonds-rekenmachine.webflow.io/gegevens?paymentType=${paymentType}&paymentSort=card`,
            })
            if (resultCardPayment.error) {
                    // Vertaal de foutmelding
                    const translatedErrorMessage = translateStripeError(resultCardPayment.error.message) || 'De betaling met uw Creditcard is niet gelukt, probeer het opnieuw.';
                
                    // Check and remove any existing failed message
                    var existingFailedMessage = document.querySelector('.failed-message');
                    if (existingFailedMessage && existingFailedMessage.parentNode) {
                        existingFailedMessage.parentNode.removeChild(existingFailedMessage);
                    }
                
                    // Create a new failed message div
                    var failedMessage = document.createElement('div');
                    failedMessage.classList.add('failed-message');
                    failedMessage.textContent = translatedErrorMessage;
                    failedMessage.style.color = 'red';
                
                    // Get the reference to the existing div where the new text should be inserted above
                    var referenceDiv = document.querySelector('.impact-tabs-menu.w-tab-menu');
                
                    // Insert the new message
                    if (referenceDiv && referenceDiv.parentNode) {
                        referenceDiv.parentNode.insertBefore(failedMessage, referenceDiv);
                    } else {
                        console.error('Element or parent of .impact-tabs-menu.w-tab-menu not found');
                    }
                }
            else {
                if(paymentType === 'riba') window.location.replace(`https://nationaal-zakat-fonds-rekenmachine.webflow.io/bedankt-riba`);
                else if(paymentType === 'zakaat') window.location.replace(`https://nationaal-zakat-fonds-rekenmachine.webflow.io/bedankt-zakaat`);
                else if(paymentType === 'sadaka') window.location.replace(`https://nationaal-zakat-fonds-rekenmachine.webflow.io/bedankt-sadaqa`);
                else window.location.replace(`https://nationaal-zakat-fonds-rekenmachine.webflow.io/bedankt-sadaqa`);
            }
        }
    })
};

const createPaymentIntent = async (amount: number) => {
    try {
        let userslowlaneData = sessionStorage.getItem("userslowlane");
        const response = await fetch('https://cloudflare-work.jabirtisou8072.workers.dev/create-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount,
                currency: 'eur',
                userslowlaneData
            })
        });
        const data: { paymentIntent_id:string; clientSecret: string, isSadakaPayment: boolean, isRibaPayment: boolean, isZakaatPayment: boolean, paymentUrl: string, isMonthly: boolean } 
            = await response.json();

        return data;
    }catch(err) {
        return null;
    }
}

init();
