// Variables para controlar las pantallas
let currentScreen = 'welcome-screen';

// Variables para WebSocket y conexión ESP32
let websocket = null;
let isConnected = false;
const ESP32_IP = '192.168.64.91'; // CAMBIAR por la IP de tu ESP32

// Elementos de las pantallas
const welcomeScreen = document.getElementById('welcome-screen');
const mainScreen = document.getElementById('main-screen');
const btnRegister = document.getElementById('btn-register');
const backButton = document.getElementById('back-button');

// Función para cambiar entre pantallas
function switchScreen(targetScreen) {
    // Ocultar pantalla actual
    document.querySelector('.screen.active').classList.remove('active');
    
    // Mostrar pantalla objetivo
    document.getElementById(targetScreen).classList.add('active');
    currentScreen = targetScreen;
    
    // Si vamos a la pantalla principal, intentar conectar
    if (targetScreen === 'main-screen' && !isConnected) {
        connectToESP32();
    }
}

// Event listeners para navegación
btnRegister.addEventListener('click', function() {
    switchScreen('main-screen');
});

backButton.addEventListener('click', function() {
    switchScreen('welcome-screen');
    // Cerrar conexión WebSocket al volver
    if (websocket) {
        websocket.close();
        isConnected = false;
    }
});

// Función para conectar con ESP32 via WebSocket
function connectToESP32() {
    try {
        console.log(`Conectando a WebSocket: ws://${ESP32_IP}/ws`);
        websocket = new WebSocket(`ws://${ESP32_IP}/ws`);
        
        websocket.onopen = function(event) {
            console.log('✅ Conectado al ESP32 exitosamente');
            isConnected = true;
            showConnectionStatus('Conectado', true);
        };
        
        websocket.onmessage = function(event) {
            try {
                console.log('📨 Mensaje recibido:', event.data);
                const data = JSON.parse(event.data);
                
                // Manejar diferentes tipos de mensajes
                if (data.type === 'sensors') {
                    console.log('🌡️ Datos de sensores:', data);
                    updateSensorData(data);
                } else if (data.type === 'leds') {
                    console.log('💡 Estado de LEDs:', data.states);
                    updateLEDStates(data.states);
                } else {
                    console.log('📊 Datos (formato anterior):', data);
                    updateSensorData(data);
                }
            } catch (error) {
                console.error('❌ Error parsing message:', error);
                console.error('Raw message:', event.data);
            }
        };
        
        websocket.onclose = function(event) {
            console.log(`🔌 Conexión WebSocket cerrada. Código: ${event.code}, Razón: ${event.reason}`);
            isConnected = false;
            showConnectionStatus('Desconectado', false);
            
            // Intentar reconectar después de 3 segundos si estamos en la pantalla principal
            if (currentScreen === 'main-screen') {
                console.log('🔄 Intentando reconectar en 3 segundos...');
                setTimeout(() => {
                    if (currentScreen === 'main-screen' && !isConnected) {
                        connectToESP32();
                    }
                }, 3000);
            }
        };
        
        websocket.onerror = function(error) {
            console.error('❌ Error WebSocket:', error);
            isConnected = false;
            showConnectionStatus('Error de conexión', false);
        };
        
    } catch (error) {
        console.error('❌ Error al crear WebSocket:', error);
        showConnectionStatus('Error de conexión', false);
    }
}

// Función para mostrar estado de conexión
function showConnectionStatus(status, connected) {
    // Crear indicador de estado si no existe
    let statusIndicator = document.querySelector('.connection-status');
    if (!statusIndicator) {
        statusIndicator = document.createElement('div');
        statusIndicator.className = 'connection-status';
        // Agregar después del header-top, como un elemento separado
        document.querySelector('.main-header').appendChild(statusIndicator);
    }
    
    statusIndicator.textContent = status;
    statusIndicator.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
}

// Función para actualizar datos de sensores
function updateSensorData(data) {
    // Actualizar temperatura
    const tempElement = document.querySelector('.temp-mini .main-value');
    if (tempElement && data.T !== undefined) {  
        tempElement.textContent = `${data.T.toFixed(1)}°`;
    }
    
    // Actualizar humedad
    const humElement = document.querySelector('.humidity-mini .main-value');
    if (humElement && data.H !== undefined) {
        humElement.textContent = `${data.H.toFixed(1)}%`;
    }
    
    // Actualizar luminosidad (usar valor calculado si está disponible, sino usar ADC)
    const lightElement = document.querySelector('.light-indicator .main-value');
    if (lightElement) {
        if (data.Light !== undefined) {
            // Usar porcentaje de luminosidad calculado
            lightElement.textContent = `${data.Light.toFixed(1)}%`;
        } else if (data.LDR !== undefined) {
            // Fallback: convertir ADC a porcentaje (compatibilidad)
            const lightPercentage = Math.round(100 - (data.LDR / 4095) * 100);
            lightElement.textContent = `${lightPercentage}%`;
        }
    }
    
    // Actualizar indicadores circulares
    updateCircularProgress(document.querySelector('.temp-mini'), (data.T / 50) * 100); // Asumiendo rango 0-50°C
    updateCircularProgress(document.querySelector('.humidity-mini'), data.H); // 0-100%
    
    // Para el indicador circular de luz, usar el valor calculado
    if (data.Light !== undefined) {
        updateCircularProgress(document.querySelector('.light-indicator'), data.Light);
    } else if (data.LDR !== undefined) {
        // Fallback
        const lightPercentage = 100 - (data.LDR / 4095) * 100;
        updateCircularProgress(document.querySelector('.light-indicator'), lightPercentage);
    }
}

// Función para actualizar los indicadores circulares con animación
function updateCircularProgress(element, percentage) {
    if (!element) return;
    
    const progressElement = element.querySelector('.circular-progress');
    if (progressElement) {
        // Limitar porcentaje entre 0 y 100
        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        
        // Diferentes colores según el tipo de sensor
        let colors = '';
        if (element.classList.contains('temp-mini')) {
            colors = `#3b82f6 0deg, #ef4444 ${clampedPercentage * 3.6}deg`;
        } else if (element.classList.contains('humidity-mini')) {
            colors = `#06b6d4 0deg, #0891b2 ${clampedPercentage * 3.6}deg`;
        } else if (element.classList.contains('light-indicator')) {
            colors = `#1e293b 0deg, #fbbf24 ${clampedPercentage * 1.8}deg, #ffffff ${clampedPercentage * 3.6}deg`;
        }
        
        progressElement.style.background = `conic-gradient(
            from -90deg,
            ${colors},
            rgba(255, 255, 255, 0.1) ${clampedPercentage * 3.6}deg
        )`;
    }
}

// Función para actualizar estado de LEDs desde el ESP32
function updateLEDStates(states) {
    states.forEach((isOn, index) => {
        const ledNumber = index + 1;
        const ledItem = document.querySelector(`.led-control-item[data-led="${ledNumber}"]`);
        
        if (ledItem) {
            const ledIndicator = ledItem.querySelector('.led-indicator');
            const ledStatus = ledItem.querySelector('.led-status');
            const ledSwitch = ledItem.querySelector('.led-switch');
            
            // Quitar clase de procesamiento
            ledItem.classList.remove('processing');
            
            // Actualizar estado real basado en respuesta del ESP32
            if (isOn) {
                ledItem.classList.add('active');
                ledSwitch.classList.add('active');
                ledIndicator.classList.add('active');
                ledStatus.textContent = 'Encendido';
            } else {
                ledItem.classList.remove('active');
                ledSwitch.classList.remove('active');
                ledIndicator.classList.remove('active');
                ledStatus.textContent = 'Apagado';
            }
        }
    });
}

// Función para controlar LEDs con respuesta inmediata y debugging
function toggleLED(switchElement, ledNumber) {
    console.log('🔥 toggleLED llamado para LED', ledNumber);
    console.log('🔗 Estado conexión:', isConnected);
    console.log('🔗 Estado WebSocket:', websocket?.readyState);
    
    // Si no hay conexión, mostrar mensaje
    if (!isConnected) {
        console.log('❌ No conectado - mostrando alerta');
        alert('No hay conexión con el ESP32. Verifica la conexión WiFi.');
        return;
    }
    
    if (!websocket || websocket.readyState !== WebSocket.OPEN) {
        console.log('❌ WebSocket no disponible');
        return;
    }
    
    // Feedback visual INMEDIATO al hacer clic
    const ledItem = switchElement.closest('.led-control-item');
    const ledIndicator = ledItem.querySelector('.led-indicator');
    const ledStatus = ledItem.querySelector('.led-status');
    const ledSwitchEl = ledItem.querySelector('.led-switch');
    const isCurrentlyActive = ledItem.classList.contains('active');
    
    console.log('🎯 Estado actual del LED:', isCurrentlyActive ? 'Encendido' : 'Apagado');
    
    // Cambiar estado visual inmediatamente (optimistic UI)
    if (isCurrentlyActive) {
        ledItem.classList.remove('active');
        ledSwitchEl.classList.remove('active');
        ledIndicator.classList.remove('active');
        ledStatus.textContent = 'Apagando...';
    } else {
        ledItem.classList.add('active');
        ledSwitchEl.classList.add('active'); 
        ledIndicator.classList.add('active');
        ledStatus.textContent = 'Encendiendo...';
    }
    
    // Agregar clase de procesamiento para animación especial
    ledItem.classList.add('processing');
    
    // Enviar comando al ESP32 (índice basado en 0)
    const ledIndex = ledNumber - 1;
    console.log('📤 Enviando comando:', ledIndex.toString());
    
    try {
        websocket.send(ledIndex.toString());
        console.log(`✅ Comando enviado: Toggle LED ${ledNumber} (índice ${ledIndex})`);
        
        // Timeout de seguridad
        setTimeout(() => {
            if (ledItem.classList.contains('processing')) {
                console.log('⚠️ Timeout: No se recibió respuesta del ESP32');
                // Revertir al estado anterior si no hay respuesta
                if (isCurrentlyActive) {
                    ledItem.classList.add('active');
                    ledSwitchEl.classList.add('active');
                    ledIndicator.classList.add('active');
                    ledStatus.textContent = 'Encendido';
                } else {
                    ledItem.classList.remove('active');
                    ledSwitchEl.classList.remove('active');
                    ledIndicator.classList.remove('active');
                    ledStatus.textContent = 'Apagado';
                }
                ledItem.classList.remove('processing');
            }
        }, 3000);
        
    } catch (error) {
        console.error('❌ Error enviando comando:', error);
        // Revertir estado en caso de error
        if (isCurrentlyActive) {
            ledItem.classList.add('active');
            ledSwitchEl.classList.add('active');
            ledIndicator.classList.add('active');
            ledStatus.textContent = 'Encendido';
        } else {
            ledItem.classList.remove('active');
            ledSwitchEl.classList.remove('active');
            ledIndicator.classList.remove('active');
            ledStatus.textContent = 'Apagado';
        }
        ledItem.classList.remove('processing');
    }
}

// Función para inicializar la aplicación
function initApp() {
    console.log('Aplicación iniciada');
    
    // Valores iniciales por defecto
    updateCircularProgress(document.querySelector('.temp-mini'), 0);
    updateCircularProgress(document.querySelector('.humidity-mini'), 0);
    updateCircularProgress(document.querySelector('.light-indicator'), 0);
    
    // Mostrar estado inicial
    showConnectionStatus('Desconectado', false);
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM cargado - inicializando app');
    initApp();
});