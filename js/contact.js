// Handle contact form submission
document.getElementById('contactForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission

    const form = event.target;
    const formData = new FormData(form);
    const responseEl = document.getElementById('formResponse');
    
    // Client-side validation
    const name = formData.get('name')?.trim();
    const email = formData.get('email')?.trim();
    const message = formData.get('message')?.trim();
    
    if (!name) {
        responseEl.textContent = 'Please enter your name.';
        responseEl.setAttribute('aria-live', 'assertive');
        return;
    }
    
    if (!email) {
        responseEl.textContent = 'Please enter your email address.';
        responseEl.setAttribute('aria-live', 'assertive');
        return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        responseEl.textContent = 'Please enter a valid email address.';
        responseEl.setAttribute('aria-live', 'assertive');
        return;
    }
    
    if (!message) {
        responseEl.textContent = 'Please enter a message.';
        responseEl.setAttribute('aria-live', 'assertive');
        return;
    }
    
    // Honeypot check
    if (formData.get('company')) {
        responseEl.textContent = 'Submission blocked.';
        return;
    }

    // Replace 'your-formspree-endpoint' with your actual Formspree endpoint
    responseEl.textContent = 'Sending...';
    
    fetch('https://formspree.io/f/xkggjlyo', {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => {
        if (response.ok) {
            responseEl.textContent = 'Thank you for your message!';
            responseEl.setAttribute('aria-live', 'polite');
            form.reset();
        } else {
            responseEl.textContent = 'Oops! There was a problem submitting your form. Please try again.';
            responseEl.setAttribute('aria-live', 'assertive');
        }
    }).catch(error => {
        console.error('Form submission error:', error);
        responseEl.textContent = 'Oops! There was a problem submitting your form. Please check your connection and try again.';
        responseEl.setAttribute('aria-live', 'assertive');
    });
});
