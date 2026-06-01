export interface ReceiptItem {
  id: string;
  description: string;
  quantity: number | '';
  unitPrice: number | '';
  discount?: number | '';
  image?: string; 
}

export interface CompanyDetails {
  name: string;
  rut: string;
  activity?: string;
  address: string;
  logo?: string;
}

export interface ClientDetails {
  name: string;
  rut: string;
  address: string;
  contact: string;
}

export interface ReceiptInfo {
  type: string;
  date: string;
  number: string;
  paymentMethod: string;
}

export interface FooterInfo {
  email: string;
  phone: string;
  website: string;
  greeting: string;
}

export interface InvoiceData {
  company: CompanyDetails;
  client: ClientDetails;
  info: ReceiptInfo;
  items: ReceiptItem[];
  footer: FooterInfo;
  notes: string;
  globalDiscount: number | '';
  documentType: 'factura' | 'boleta_venta' | 'boleta_honorarios' | 'recibo';
  theme: 'classic' | 'emerald' | 'minimalist' | 'violet';
  currency: string;
}

export interface SavedDraft {
  id: string;
  name: string;
  date: string;
  data: InvoiceData;
}

export interface SavedClient {
  id: string;
  name: string;
  rut: string;
  address: string;
  contact: string;
}

