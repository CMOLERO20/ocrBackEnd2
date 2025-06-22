
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const vision = require("@google-cloud/vision");
const path = require("path");

const client = new vision.ImageAnnotatorClient();

require('dotenv').config();
const app = express();
const upload = multer({ dest: "uploads/" });
app.use(cors());

function extraerDatos(texto) {
  const lineas = texto.split("\n").map(l => l.trim()).filter(Boolean);

  const datos = {
    vendedor: lineas[0] || "",
    cp: lineas[8]?.replace(/^CP\s*/i, "") || "",
    localidad: lineas[9] || "",
    referencia: "",
    recieverAddress: "",
    recieverName: "",
    venta: "",
  };

  // 🟨 Dirección: tolerancia en línea 11, 12, 13
  const posibleDireccion = [lineas[11], lineas[12], lineas[13]].find(
    l =>
      l?.toLowerCase().includes("calle") ||
      l?.toLowerCase().includes("direccion")
  );
  if (posibleDireccion) {
    datos.recieverAddress = posibleDireccion
      .replace(/^(calle|dirección|direccion)[: ]*/i, "")
      .trim();
  }

  // 🟦 Destinatario: buscar en línea 15 o 16
  const posibleDestinatario = [lineas[15], lineas[16]].find(
    l => l?.toLowerCase().includes("destinatario")
  );
  if (posibleDestinatario) {
    datos.recieverName = posibleDestinatario
      .replace(/^Destinatario[: ]*/i, "")
      .trim();
  }

   const posibleReferencia = [lineas[13], lineas[14]].find(
    l => l?.toLowerCase().includes("referencia")
  );
  if (posibleReferencia) {
    datos.referencia = posibleReferencia
      .replace(/^Referencia[: ]*/i, "")
      .trim();
  }

  // 🔴 Venta: unir todos los bloques numéricos en la línea 3
  if (lineas[3]) {
    const bloques = lineas[3].match(/\d+/g); // busca todos los grupos de números
    const ventaUnida = bloques?.join("") || "";
    if (ventaUnida.length >= 16) {
      datos.venta = ventaUnida.slice(0, 16); // solo los primeros 16 dígitos
    }
  }

  return datos;
}
app.post("/ocr", upload.single("archivo"), async (req, res) => {
  if (!req.file) {
    console.log("❌ No se recibió archivo");
    return res.status(400).json({ error: "No se recibió archivo" });
  }

  const filePath = req.file.path;
  console.log("📤 Procesando:", filePath);

  try {
    const [result] = await client.textDetection(filePath);
    console.log("✅ Resultado recibido");

    const detections = result.textAnnotations;
    const texto = detections.length ? detections[0].description : "";

    const datos = extraerDatos(texto);
    fs.unlinkSync(filePath);

    return res.json({ texto, datos });
  } catch (error) {
    console.error("❌ Error Vision API:", error.message);
    return res.status(500).json({ error: error.message, detalles: error });
  }
});

app.listen(4000, () => {
  console.log("Servidor OCR con Google Vision corriendo en http://localhost:4000");
});
