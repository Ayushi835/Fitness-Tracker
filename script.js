// Select all buttons that contain the text "Get Started"
const startButtons = document.querySelectorAll('button');

startButtons.forEach(button => {
    if (button.textContent.includes('Get Started')) {
        button.addEventListener('click', () => {
            // Change the URL to your signup page
            window.location.href = 'signup.html';
        });
    }
});

