'use strict';

// Validación general en tiempo real para caracteres (precios, números, nombres)
document.addEventListener('input', (e) => {
    const input = e.target;
    if (input.tagName !== 'INPUT') return;

    const identificador = (input.id + ' ' + (input.name || '')).toLowerCase();

    if (identificador.includes('precio')) {
        const limpio = input.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
        if (limpio !== input.value) input.value = limpio;
    } else if (['telefono', 'cantidad', 'llenas', 'vacias'].some((k) => identificador.includes(k))) {
        const limpio = input.value.replace(/\D/g, '');
        if (limpio !== input.value) input.value = limpio;
    } else if (identificador.includes('nombre') && !identificador.includes('usuario')) {
        const limpio = input.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
        if (limpio !== input.value) input.value = limpio;
    }
});

// Inicialización de validaciones visuales cuando carga el DOM
document.addEventListener('DOMContentLoaded', () => {
    initValidacionLogin();
    initValidacionPassword();
});

function initValidacionLogin() {
    const inputUsuario = $('login-usuario');
    const inputPassword = $('login-password');
    const errorUsuario = $('error-login-usuario');
    const errorPassword = $('error-login-password');

    const validarCampo = (input, errorEl, mensajeCustom) => {
        if (!input) return true;
        if (!input.value.trim()) {
            input.style.borderColor = '#e74c3c'; // Rojo error
            if (errorEl) {
                errorEl.textContent = mensajeCustom || 'Este campo es obligatorio.';
                errorEl.style.display = 'block';
            }
            return false;
        } else {
            input.style.borderColor = '#27ae60'; // Verde éxito
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
            return true;
        }
    };

    if (inputUsuario) {
        inputUsuario.addEventListener('blur', () => validarCampo(inputUsuario, errorUsuario, 'Ingresá tu nombre de usuario.'));
        inputUsuario.addEventListener('input', () => {
            if (inputUsuario.value.trim()) {
                inputUsuario.style.borderColor = '#27ae60';
                if (errorUsuario) errorUsuario.style.display = 'none';
            }
        });
    }

    if (inputPassword) {
        inputPassword.addEventListener('blur', () => validarCampo(inputPassword, errorPassword, 'Ingresá tu contraseña.'));
        inputPassword.addEventListener('input', () => {
            if (inputPassword.value.trim()) {
                inputPassword.style.borderColor = '#27ae60';
                if (errorPassword) errorPassword.style.display = 'none';
            }
        });
    }
}

// Función global que valida campos vacíos antes de enviar
window.validarFormularioLogin = function() {
    const inputUsuario = $('login-usuario');
    const inputPassword = $('login-password');
    const errorUsuario = $('error-login-usuario');
    const errorPassword = $('error-login-password');

    let esValido = true;

    if (inputUsuario && !inputUsuario.value.trim()) {
        inputUsuario.style.borderColor = '#e74c3c';
        if (errorUsuario) {
            errorUsuario.textContent = 'Ingresá tu nombre de usuario.';
            errorUsuario.style.display = 'block';
        }
        esValido = false;
    }

    if (inputPassword && !inputPassword.value.trim()) {
        inputPassword.style.borderColor = '#e74c3c';
        if (errorPassword) {
            errorPassword.textContent = 'Ingresá tu contraseña.';
            errorPassword.style.display = 'block';
        }
        esValido = false;
    }

    if (!esValido) {
        if (inputUsuario && !inputUsuario.value.trim()) inputUsuario.focus();
        else if (inputPassword && !inputPassword.value.trim()) inputPassword.focus();
    }

    return esValido;
};

// Función global para que auth_2.js pinte de rojo un input específico cuando el servidor falle
window.mostrarErrorServidorLogin = function(mensaje) {
    const inputUsuario = $('login-usuario');
    const inputPassword = $('login-password');
    const errorPassword = $('error-login-password');

    // Si el servidor dice que hubo un error de credenciales, pintamos ambos bordes de rojo y ponemos el mensaje abajo
    if (inputUsuario) inputUsuario.style.borderColor = '#e74c3c';
    if (inputPassword) inputPassword.style.borderColor = '#e74c3c';
    
    if (errorPassword) {
        errorPassword.textContent = mensaje || 'Usuario o contraseña incorrectos.';
        errorPassword.style.display = 'block';
    }
};

function initValidacionPassword() {
    const passwordInput = $('nueva-pass');
    const errorPassword = $('error-password');
    const formUsuario = $('form-usuario');
    if (!passwordInput || !errorPassword) return;

    const regexPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

    passwordInput.addEventListener('input', () => {
        const valor = passwordInput.value;
        if (valor === '') {
            errorPassword.style.display = 'none';
            passwordInput.style.borderColor = '';
        } else if (!regexPassword.test(valor)) {
            errorPassword.textContent = 'Debe tener al menos 8 caracteres, mayúsculas, minúsculas, números y un carácter especial.';
            errorPassword.style.display = 'block';
            passwordInput.style.borderColor = '#e74c3c';
        } else {
            errorPassword.style.display = 'none';
            passwordInput.style.borderColor = '#27ae60';
        }
    });

    if (formUsuario) {
        formUsuario.addEventListener('submit', (e) => {
            if (!regexPassword.test(passwordInput.value)) {
                e.preventDefault();
                errorPassword.textContent = 'La contraseña no cumple con los requisitos de seguridad.';
                errorPassword.style.display = 'block';
                passwordInput.style.borderColor = '#e74c3c';
                passwordInput.focus();
            }
        });
    }
}