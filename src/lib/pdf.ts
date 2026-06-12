import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PresupuestoData } from '../components/forms/PresupuestoForm'
import type { FacturaData } from '../components/forms/FacturaForm'
import logoUrl from '../assets/Akiter-logo.png.png'

interface ClienteInfo { nombre: string; cif?: string; localidad?: string; email?: string }

const green = [26, 74, 46] as [number, number, number]
const gold  = [201, 168, 76] as [number, number, number]

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl)
    const blob = await res.blob()
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function drawHeader(doc: jsPDF, logo: string | null, docType: string, numero: string, fecha: string) {
  doc.setFillColor(...green)
  doc.rect(0, 0, 210, 32, 'F')

  if (logo) {
    doc.addImage(logo, 'PNG', 12, 6, 20, 20)
    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text('AKITER', 35, 16)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...gold)
    doc.text('ERP · Gestión Empresarial', 35, 23)
  } else {
    doc.setFontSize(22)
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text('AKITER', 14, 16)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...gold)
    doc.text('ERP · Gestión Empresarial', 14, 23)
  }

  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.text(docType, 196, 12, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(numero, 196, 20, { align: 'right' })
  doc.setFontSize(8)
  doc.text(`Fecha: ${fecha}`, 196, 27, { align: 'right' })
}

function drawClientBlock(doc: jsPDF, startY: number, cliente?: ClienteInfo) {
  doc.setTextColor(50, 50, 50)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('CLIENTE', 14, startY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(cliente?.nombre ?? '—', 14, startY + 7)
  let offset = startY + 7
  if (cliente?.cif) { offset += 6; doc.text(`CIF: ${cliente.cif}`, 14, offset) }
  if (cliente?.localidad) { offset += 6; doc.text(cliente.localidad, 14, offset) }
  if (cliente?.email) { offset += 6; doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.text(cliente.email, 14, offset) }
}

function drawLineItemsTable(doc: jsPDF, lineas: { descripcion: string; cantidad: number; precio_unitario: number; total: number }[], ivaPct: number, startY: number) {
  const baseImponible = lineas.reduce((s, l) => s + l.total, 0)
  const importeIva = baseImponible * ivaPct / 100
  const total = baseImponible + importeIva

  autoTable(doc, {
    startY,
    head: [['Descripción', 'Cant.', 'P. Unitario', 'Total']],
    body: lineas.map(l => [
      l.descripcion,
      l.cantidad.toString(),
      `${l.precio_unitario.toFixed(2)} €`,
      `${l.total.toFixed(2)} €`,
    ]),
    foot: [
      ['', '', 'Base imponible:', `${baseImponible.toFixed(2)} €`],
      ['', '', `IVA (${ivaPct}%):`, `${importeIva.toFixed(2)} €`],
      ['', '', 'TOTAL:', `${total.toFixed(2)} €`],
    ],
    headStyles: { fillColor: green, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: [245, 245, 245], textColor: [50, 50, 50], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 },
    },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.row.index === 2) {
        data.cell.styles.textColor = green
        data.cell.styles.fontSize = 11
      }
    },
  })

  return { baseImponible, importeIva, total }
}

function drawFooter(doc: jsPDF, notas?: string) {
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  if (notas) {
    const y = finalY + 10
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('Condiciones:', 14, y)
    doc.setTextColor(80, 80, 80)
    doc.text(notas, 14, y + 5, { maxWidth: 182 })
  }

  doc.setFontSize(7)
  doc.setTextColor(160, 160, 160)
  doc.text('Documento generado por Akiter ERP', 105, 290, { align: 'center' })
}

export async function generarPDFPresupuesto(presupuesto: PresupuestoData, cliente?: ClienteInfo) {
  const logo = await loadLogo()
  const doc = new jsPDF()

  drawHeader(doc, logo, 'PRESUPUESTO', presupuesto.numero, presupuesto.fecha_emision)
  drawClientBlock(doc, 44, cliente)

  if (presupuesto.fecha_validez) {
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`Válido hasta: ${presupuesto.fecha_validez}`, 196, 44, { align: 'right' })
  }

  if (presupuesto.descripcion) {
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(`Objeto: ${presupuesto.descripcion}`, 14, 72)
  }

  drawLineItemsTable(doc, presupuesto.lineas, presupuesto.iva_porcentaje, 80)
  drawFooter(doc, presupuesto.notas)

  doc.save(`${presupuesto.numero}.pdf`)
}

export async function generarPDFFactura(factura: FacturaData, cliente?: ClienteInfo) {
  const logo = await loadLogo()
  const doc = new jsPDF()

  drawHeader(doc, logo, 'FACTURA', factura.numero, factura.fecha_emision)

  // Client + invoice metadata block
  drawClientBlock(doc, 44, cliente)

  if (factura.fecha_vencimiento) {
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text(`Vencimiento: ${factura.fecha_vencimiento}`, 196, 44, { align: 'right' })
  }

  // Concepto
  if (factura.concepto) {
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text(`Concepto: ${factura.concepto}`, 14, 72)
  }

  const lineas = (factura.lineas ?? []).length > 0
    ? factura.lineas
    : [{ descripcion: factura.concepto ?? '—', cantidad: 1, precio_unitario: Number(factura.base_imponible ?? 0), total: Number(factura.base_imponible ?? 0) }]

  drawLineItemsTable(doc, lineas, factura.iva_porcentaje ?? 21, 80)
  drawFooter(doc, factura.notas)

  doc.save(`${factura.numero}.pdf`)
}
