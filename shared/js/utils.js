// Shared utility functions for all pages
export function showError(message, form) {
    // Remove any existing error messages
    const existingError = form.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Create and show new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    form.insertBefore(errorDiv, form.firstChild);
    
    // Remove error after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.remove();
        }
    }, 5000);
}

export function showSuccess(message, form) {
    // Remove any existing messages
    const existingMessage = form.querySelector('.success-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create and show success message
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    form.insertBefore(successDiv, form.firstChild);
    
    // Remove success message after 3 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 3000);
}

export function addLoadingState(button) {
    button.disabled = true;
    button.innerHTML = '<span class="loading"></span> Loading...';
}

export function removeLoadingState(button, originalText) {
    button.disabled = false;
    button.innerHTML = originalText;
}

export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validatePassword(password) {
    return password.length >= 6;
}

// Navigation helper
export function navigateToPage(pagePath) {
    window.location.href = pagePath;
}