import { InvoiceData } from '../types';
import { IVA_RATE, RETENCION_HONORARIOS_RATE } from '../constants/tax';

export interface InvoiceTotals {
  subtotalNeto: number;
  baseMonto: number;
  taxName: string;
  taxValue: number;
  finalTotal: number;
}

/** Calcula subtotal, impuesto y total según el tipo de documento chileno. */
export function computeInvoiceTotals(data: InvoiceData): InvoiceTotals {
  const subtotalNeto = data.items.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    return acc + (qty * price - disc);
  }, 0);

  const rawGlobalDiscount = Number(data.globalDiscount) || 0;
  const baseMonto = Math.max(0, subtotalNeto - rawGlobalDiscount);

  let taxName = 'IVA (19%)';
  let taxValue = 0;
  let finalTotal = baseMonto;

  switch (data.documentType) {
    case 'factura': {
      // Neto + IVA
      taxValue = Math.round(baseMonto * IVA_RATE);
      finalTotal = baseMonto + taxValue;
      break;
    }
    case 'boleta_venta': {
      // IVA incluido en el monto
      finalTotal = baseMonto;
      const neto = Math.round(baseMonto / (1 + IVA_RATE));
      taxValue = baseMonto - neto;
      taxName = 'IVA Incluido (19%)';
      break;
    }
    case 'boleta_honorarios': {
      taxName = `Retención (${(RETENCION_HONORARIOS_RATE * 100).toFixed(2)}%)`;
      taxValue = Math.round(baseMonto * RETENCION_HONORARIOS_RATE);
      finalTotal = baseMonto - taxValue; // Total líquido
      break;
    }
    case 'recibo':
    default: {
      finalTotal = baseMonto;
      taxValue = 0;
      break;
    }
  }

  return { subtotalNeto, baseMonto, taxName, taxValue, finalTotal };
}
