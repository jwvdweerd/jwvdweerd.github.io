// Handle contact form submission
document.getElementById('contactForm').addEventListener('submit', function(event) {
    event.preventDefault(); // Prevent the default form submission

    const form = event.target;
    const formData = new FormData(form);
    // Honeypot check
    if (formData.get('company')) {
        document.getElementById('formResponse').textContent = 'Submission blocked.';
        return;
    }

    // Replace 'your-formspree-endpoint' with your actual Formspree endpoint
    fetch('https://formspree.io/f/xkggjlyo', {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => {
        if (response.ok) {
            document.getElementById('formResponse').textContent = 'Thank you for your message!';
            form.reset();
        } else {
            document.getElementById('formResponse').textContent = 'Oops! There was a problem submitting your form.';
        }
    }).catch(error => {
        document.getElementById('formResponse').textContent = 'Oops! There was a problem submitting your form.';
    });
});
