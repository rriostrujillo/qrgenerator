# 📱 Generador QR – Gaceta Universitaria UNACH

Generador de códigos QR personalizados con logotipo, colores y temas predefinidos.  
Desarrollado para la **Gaceta Universitaria de la UNACH**.

---

## 🚀 Instalación y uso

> **Requisito:** Node.js ≥ 14

```bash
# 1. Clonar el repositorio
git clone https://github.com/<tu-usuario>/qrgenerator.git
cd qrgenerator

# 2. Arrancar el servidor local
npm start
# o bien: node server.js

# 3. Abrir en el navegador
# http://localhost:3030
```

---

## ✨ Características

- Genera códigos QR a partir de cualquier texto o URL
- Inserta el logo de la Gaceta UNACH en el centro del QR
- Personalización de colores (módulos, fondo, logo)
- 6 temas predefinidos (Institucional, Dorado, Verde, Oscuro, Rojo, Morado)
- Descarga en formato PNG
- Proxy CORS integrado para cargar logos desde URLs externas
- Diseño responsive

---

## 📁 Estructura

```
qrgenerator/
├── index.html   # Interfaz principal
├── style.css    # Estilos (glassmorphism, animaciones)
├── app.js       # Lógica del generador
├── server.js    # Servidor Node.js + proxy CORS
├── package.json
└── README.md
```

---

## 🖥️ Capturas

*Abre `http://localhost:3030` después de ejecutar `npm start`.*

---

## 📄 Licencia

MIT © Gaceta Universitaria UNACH
