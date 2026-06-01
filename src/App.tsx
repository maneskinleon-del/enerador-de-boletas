import React, { useState, useEffect, useRef } from 'react';
import { 
  Download, Plus, Trash2, Image as ImageIcon, Hexagon, Printer, Info, 
  Mail, Phone, Globe, ChevronUp, ChevronDown, Check, Save, Sparkles, 
  Key, FileText, Settings, History, User, Building, Eye, Edit2, Loader2, RefreshCw
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { GoogleGenAI } from '@google/genai';
import { InvoiceData, SavedDraft, SavedClient } from './types';

// Helper component for clean editable inline text
const EditableText = ({ 
  value, 
  onChange, 
  className = '', 
  placeholder = '', 
  readOnly = false,
  multiline = false
}: any) => {
  const commonClasses = `bg-transparent border-none focus:ring-2 focus:ring-t-primary/20 rounded-md outline-none print:appearance-none hover:bg-t-accent-bg/80 focus:bg-t-accent-bg print:hover:bg-transparent transition-colors text-inherit font-inherit ${className} ${readOnly ? 'hover:bg-transparent focus:ring-0 cursor-default' : 'cursor-text px-1'}`;
  
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`${commonClasses} resize-none block py-1 overflow-hidden print:overflow-visible`}
        rows={Math.max(1, (value.match(/\n/g) || []).length + 1)}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = target.scrollHeight + 'px';
        }}
        style={{ height: value ? 'auto' : undefined }}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`${commonClasses} py-0.5`}
    />
  );
};

// Helper component for clean editable inline numbers
const EditableNumber = ({ value, onChange, className = '', placeholder = '', readOnly = false }: any) => {
  return (
    <input
      type="number"
      value={value === '' ? '' : value}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val === '' ? '' : Number(val));
      }}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`no-spinners bg-transparent border-none focus:ring-2 focus:ring-t-primary/20 rounded-md outline-none print:appearance-none hover:bg-t-accent-bg/80 focus:bg-t-accent-bg print:hover:bg-transparent transition-colors text-inherit font-inherit ${className} ${readOnly ? 'hover:bg-transparent focus:ring-0 cursor-default' : 'cursor-text px-1 py-0.5'}`}
    />
  );
};

const defaultData: InvoiceData = {
  documentType: 'factura',
  theme: 'classic',
  currency: 'CLP',
  company: {
    name: "Soluciones Tecnológicas SpA",
    rut: "76.452.891-K",
    activity: "Servicios de Consultoría y Desarrollo de Software",
    address: "Av. Andrés Bello 2711, Of 1202, Las Condes, Santiago",
    logo: ''
  },
  client: {
    name: "Comercializadora Pacífico Ltda",
    rut: "78.112.304-5",
    address: "Calle Los Almendros 450, Viña del Mar",
    contact: "finanzas@pacifico.cl"
  },
  info: {
    type: "Factura Electrónica",
    date: new Date().toLocaleDateString('es-CL'),
    number: "184",
    paymentMethod: "Transferencia Electrónica"
  },
  items: [
    { id: '1', description: "Servicio de desarrollo Frontend - Módulo de Reportes React", quantity: 1, unitPrice: 850000, discount: 0, image: '' },
    { id: '2', description: "Soporte técnico mensual y optimizaciones SEO", quantity: 2, unitPrice: 150000, discount: 20000, image: '' }
  ],
  footer: {
    email: "pagos@soluciones.cl",
    phone: "+56 9 8765 4321",
    website: "www.solucionestecnologicas.cl",
    greeting: "Gracias por hacer negocios con nosotros."
  },
  notes: "Banco de Chile\nCuenta Corriente: 00-123-45678-09\nRut: 76.452.891-K\nCorreo para comprobante: pagos@soluciones.cl",
  globalDiscount: 0
};

export default function App() {
  const [data, setData] = useState<InvoiceData>(() => {
    try {
      const saved = localStorage.getItem('boletacraft_invoice_draft');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load from localStorage', e);
    }
    return defaultData;
  });

  // Editor states
  const [activeTab, setActiveTab] = useState<'documento' | 'emisor_receptor' | 'items' | 'ai' | 'historial'>('documento');
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit');
  const [showAdvancedMobile, setShowAdvancedMobile] = useState(false);
  const [mobileQuickMode, setMobileQuickMode] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [scale, setScale] = useState(1);
  const [paperHeight, setPaperHeight] = useState(1056);
  const containerRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  // Check if screen is mobile size (under 1024px)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ResizeObserver for dynamic preview scaling on mobile
  useEffect(() => {
    const containerElement = containerRef.current;
    const paperElement = document.getElementById('receipt-paper') as HTMLDivElement | null;
    if (!containerElement || !paperElement) return;

    let frameId = 0;

    const updatePaperScale = () => {
      const containerWidth = containerElement.clientWidth;
      const paperWidth = paperElement.offsetWidth || 816;
      const nextScale = containerWidth > 0 && paperWidth > 0
        ? Math.min(1, containerWidth / paperWidth)
        : 1;

      setPaperHeight(paperElement.scrollHeight);
      setScale(nextScale);
    };

    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(updatePaperScale);
    });

    updatePaperScale();
    resizeObserver.observe(containerElement);
    resizeObserver.observe(paperElement);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
    };
  }, []);

  // Quick Mode Sync Effect: enforce exactly 1 item with quantity = 1, discount = 0 when active
  useEffect(() => {
    if (isMobile && mobileQuickMode) {
      setData(d => {
        const firstItem = d.items[0] || { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0, discount: 0, image: '' };
        return {
          ...d,
          items: [{
            ...firstItem,
            quantity: 1,
            discount: 0
          }]
        };
      });
    }
  }, [mobileQuickMode, isMobile]);
  
  // Saved states
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>(() => {
    try {
      const saved = localStorage.getItem('boletacraft_drafts');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [savedClients, setSavedClients] = useState<SavedClient[]>(() => {
    try {
      const saved = localStorage.getItem('boletacraft_clients');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // AI states
  const [apiKey, setApiKey] = useState<string>(() => {
    return (import.meta as any).env?.VITE_GEMINI_API_KEY || localStorage.getItem('boletacraft_gemini_key') || '';
  });
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ type: 'success' | 'error' | '', message: string }>({ type: '', message: '' });
  
  // Draft Save State
  const [draftName, setDraftName] = useState('');
  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem('boletacraft_invoice_draft', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    localStorage.setItem('boletacraft_drafts', JSON.stringify(savedDrafts));
  }, [savedDrafts]);

  useEffect(() => {
    localStorage.setItem('boletacraft_clients', JSON.stringify(savedClients));
  }, [savedClients]);

  // Document types names mappings
  const getDocumentTypeName = (type: string) => {
    switch (type) {
      case 'factura': return 'Factura Afecta';
      case 'boleta_venta': return 'Boleta de Venta';
      case 'boleta_honorarios': return 'Boleta de Honorarios';
      case 'recibo': return 'Recibo de Pago';
      default: return 'Documento';
    }
  };

  // Set default document type label when changing type
  const handleDocumentTypeChange = (type: 'factura' | 'boleta_venta' | 'boleta_honorarios' | 'recibo') => {
    setData(d => ({
      ...d,
      documentType: type,
      info: {
        ...d.info,
        type: getDocumentTypeName(type)
      }
    }));
  };

  // Company and Client handlers
  const updateCompany = (field: string, val: string) => setData(d => ({ ...d, company: { ...d.company, [field]: val } }));
  const updateClient = (field: string, val: string) => setData(d => ({ ...d, client: { ...d.client, [field]: val } }));
  const updateInfo = (field: string, val: string) => setData(d => ({ ...d, info: { ...d.info, [field]: val } }));
  const updateFooter = (field: string, val: string) => setData(d => ({ ...d, footer: { ...d.footer, [field]: val } }));

  // Items handlers
  const addItem = () => {
    setData(d => ({
      ...d, 
      items: [...d.items, { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0, discount: 0, image: '' }]
    }));
  };

  const removeItem = (id: string) => {
    setData(d => ({
      ...d,
      items: d.items.length > 1 ? d.items.filter(item => item.id !== id) : d.items
    }));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setData(d => ({
      ...d,
      items: d.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...data.items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setData(d => ({ ...d, items: newItems }));
  };

  // Draft management
  const saveDraft = () => {
    const name = draftName.trim() || `Draft ${getDocumentTypeName(data.documentType)} #${data.info.number || Date.now()}`;
    const newDraft: SavedDraft = {
      id: Date.now().toString(),
      name,
      date: new Date().toLocaleString('es-CL'),
      data
    };
    setSavedDrafts(prev => [newDraft, ...prev]);
    setDraftName('');
    setAiStatus({ type: 'success', message: `Borrador "${name}" guardado exitosamente.` });
    setTimeout(() => setAiStatus({ type: '', message: '' }), 3000);
  };

  const loadDraft = (draft: SavedDraft) => {
    if (confirm(`¿Cargar borrador "${draft.name}"? Perderás los cambios no guardados.`)) {
      setData(draft.data);
      setAiStatus({ type: 'success', message: `Borrador "${draft.name}" cargado.` });
      setTimeout(() => setAiStatus({ type: '', message: '' }), 3000);
    }
  };

  const deleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Eliminar este borrador del historial?')) {
      setSavedDrafts(prev => prev.filter(d => d.id !== id));
    }
  };

  // Client database management
  const saveClient = () => {
    if (!data.client.name) {
      alert('Por favor ingresa un nombre para el cliente antes de guardarlo.');
      return;
    }
    const newClient: SavedClient = {
      id: Date.now().toString(),
      name: data.client.name,
      rut: data.client.rut,
      address: data.client.address,
      contact: data.client.contact
    };
    setSavedClients(prev => {
      // Avoid duplicate client names
      const filtered = prev.filter(c => c.name.toLowerCase() !== data.client.name.toLowerCase());
      return [newClient, ...filtered];
    });
    alert('Cliente guardado en tu base de datos.');
  };

  const loadClient = (client: SavedClient) => {
    setData(d => ({
      ...d,
      client: {
        name: client.name,
        rut: client.rut,
        address: client.address,
        contact: client.contact
      }
    }));
  };

  const deleteClient = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Eliminar este cliente guardado?')) {
      setSavedClients(prev => prev.filter(c => c.id !== id));
    }
  };

  // Calculations engine according to Document Type
  const subtotalNeto = data.items.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discount) || 0;
    return acc + ((qty * price) - disc);
  }, 0);

  const rawGlobalDiscount = Number(data.globalDiscount) || 0;
  const baseMonto = Math.max(0, subtotalNeto - rawGlobalDiscount);

  let displayedSubtotal = subtotalNeto;
  let taxName = 'IVA (19%)';
  let taxValue = 0;
  let finalTotal = baseMonto;
  let exento = 0;

  if (data.documentType === 'factura') {
    // Neto + IVA
    taxValue = Math.round(baseMonto * 0.19);
    finalTotal = baseMonto + taxValue;
  } else if (data.documentType === 'boleta_venta') {
    // IVA included
    finalTotal = baseMonto;
    const neto = Math.round(baseMonto / 1.19);
    taxValue = baseMonto - neto;
    taxName = 'IVA Incluido (19%)';
  } else if (data.documentType === 'boleta_honorarios') {
    // Retencion Chilena (13.75% for 2026/2027)
    const retencionRate = 0.1375;
    taxName = 'Retención (13.75%)';
    taxValue = Math.round(baseMonto * retencionRate);
    finalTotal = baseMonto - taxValue; // Total Líquido
  } else if (data.documentType === 'recibo') {
    // No taxes
    finalTotal = baseMonto;
    taxValue = 0;
  }

  // Format currencies dynamically
  const formatCurrency = (val: number) => {
    if (data.currency === 'CLP') {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);
    } else if (data.currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    } else if (data.currency === 'EUR') {
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    } else { // UF
      return `UF ${new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, onLoad: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => onLoad(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetData = () => {
    if (confirm("¿Estás seguro de que deseas limpiar el borrador? Volverás al diseño inicial.")) {
      setData({
        ...defaultData,
        info: { ...defaultData.info, date: new Date().toLocaleDateString('es-CL') }
      });
      setAiStatus({ type: 'success', message: 'Formulario restablecido.' });
      setTimeout(() => setAiStatus({ type: '', message: '' }), 3000);
    }
  };

  const fillMockData = () => {
    setData({
      documentType: 'boleta_honorarios',
      theme: 'emerald',
      currency: 'CLP',
      company: {
        name: "Clara Inés Gómez Valenzuela",
        rut: "15.782.903-5",
        activity: "Diseño Gráfico Independiente y UX/UI",
        address: "Avenida Providencia 2330, Depto 904, Providencia",
        logo: ''
      },
      client: {
        name: "Inmobiliaria El Roble SpA",
        rut: "76.992.833-2",
        address: "San Sebastián 2800, Las Condes",
        contact: "contacto@elroble.cl"
      },
      info: {
        type: "Boleta de Honorarios Electrónica",
        date: new Date().toLocaleDateString('es-CL'),
        number: "87",
        paymentMethod: "Transferencia a Cuenta Rut"
      },
      items: [
        { id: '1', description: "Rediseño completo de Landing Page y UX Research para Portal Clientes", quantity: 1, unitPrice: 480000, discount: 0 },
        { id: '2', description: "Diseño de identidad corporativa y kit de Redes Sociales", quantity: 1, unitPrice: 220000, discount: 0 }
      ],
      footer: {
        email: "clara.gomez@gmail.com",
        phone: "+56 9 9988 7766",
        website: "www.claradesign.cl",
        greeting: "Es un agrado colaborar con vuestro equipo."
      },
      notes: "Banco Estado\nCuenta Rut: 15782903\nEmail para comprobante: clara.gomez@gmail.com",
      globalDiscount: 0
    });
  };

  const createReceiptCaptureClone = (source: HTMLDivElement) => {
    const clone = source.cloneNode(true) as HTMLDivElement;
    const sourceStyles = window.getComputedStyle(source);
    const themeVariables = [
      '--color-t-primary',
      '--color-t-primary-light',
      '--color-t-accent',
      '--color-t-accent-bg',
      '--color-t-text',
      '--color-t-border'
    ];

    themeVariables.forEach((variable) => {
      clone.style.setProperty(variable, sourceStyles.getPropertyValue(variable));
    });

    clone.removeAttribute('id');
    clone.style.width = '816px';
    clone.style.maxWidth = 'none';
    clone.style.minHeight = '1056px';
    clone.style.height = 'auto';
    clone.style.transform = 'none';
    clone.style.transformOrigin = 'top center';
    clone.style.position = 'absolute';
    clone.style.left = '-10000px';
    clone.style.top = '0';
    clone.style.zIndex = '-1';
    clone.style.pointerEvents = 'none';
    clone.style.overflow = 'visible';
    clone.style.borderRadius = '0';
    clone.style.boxShadow = 'none';

    clone.querySelectorAll<HTMLElement>('[class*="print:hidden"]').forEach((element) => {
      element.style.display = 'none';
    });

    document.body.appendChild(clone);

    return {
      clone,
      cleanup: () => clone.remove()
    };
  };

  // PDF Export logic
  const handleExportPDFDirect = async () => {
    const element = paperRef.current;
    if (!element) return;
    
    setAiLoading(true);
    const { clone, cleanup } = createReceiptCaptureClone(element);

    try {
      const captureHeight = Math.max(clone.scrollHeight, 1056);
      const canvas = await html2canvas(clone, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 816,
        height: captureHeight,
        windowWidth: 816,
        windowHeight: captureHeight,
        scrollX: 0,
        scrollY: 0
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });
      
      const imgWidth = 215.9; // Letter width in mm
      const pageHeight = 279.4; // Letter height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      
      let heightLeft = imgHeight - pageHeight;
      
      while (heightLeft > 0) {
        const position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      const docName = `${getDocumentTypeName(data.documentType).replace(/\s+/g, '-')}-${data.info.number || 'doc'}.pdf`;
      pdf.save(docName);
      setAiStatus({ type: 'success', message: 'PDF generado y descargado exitosamente.' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Hubo un error al generar el PDF. Por favor, utiliza la opción de Guardar en PDF Nativo.');
    } finally {
      cleanup();
      setAiLoading(false);
      setTimeout(() => setAiStatus({ type: '', message: '' }), 4000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Save API Key
  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('boletacraft_gemini_key', key);
    setShowKeyInput(false);
    setAiStatus({ type: 'success', message: 'API Key de Gemini guardada correctamente.' });
    setTimeout(() => setAiStatus({ type: '', message: '' }), 3000);
  };

  // Gemini AI Fill
  const handleAiFill = async () => {
    if (!aiPrompt.trim()) return;
    if (!apiKey) {
      setShowKeyInput(true);
      alert('Por favor ingresa una API Key de Gemini para activar esta función.');
      return;
    }

    setAiLoading(true);
    setAiStatus({ type: '', message: '' });

    const systemPrompt = `Eres un experto administrativo chileno. Analiza el siguiente texto en español y extrae la información para rellenar un documento de cobro (Boleta o Factura).
Debes identificar:
1. El cliente (Nombre/Razón Social, RUT si se menciona, Dirección, Correo/Teléfono).
2. Los productos o servicios cobrados (Nombre/Descripción, Cantidad, Precio Unitario, y si hay descuento).
3. Moneda sugerida (CLP, USD, EUR, etc. según el texto).

Genera un objeto JSON estrictamente en este formato (sin rodeos, sin markdown extra, solo el objeto JSON plano):
{
  "client": {
    "name": "Nombre o Razón social encontrada",
    "rut": "RUT encontrado (formato XX.XXX.XXX-X o vacío)",
    "address": "Dirección encontrada o vacía",
    "contact": "Correo o teléfono encontrado o vacío"
  },
  "items": [
    {
      "description": "Descripción clara del servicio o producto",
      "quantity": número entero,
      "unitPrice": número (precio unitario),
      "discount": número de descuento o 0
    }
  ],
  "currency": "CLP" o "USD" o "EUR"
}

Texto de usuario a analizar:
"${aiPrompt}"`;

    try {
      const ai = new GoogleGenAI({ apiKey: apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
        config: {
          responseMimeType: 'application/json',
        }
      });

      const responseText = response.text || '';
      const parsedData = JSON.parse(responseText);

      // Apply changes to layout
      setData(prev => {
        const formattedItems = (parsedData.items || []).map((item: any, idx: number) => ({
          id: (Date.now() + idx).toString(),
          description: item.description || 'Artículo extraído',
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          discount: Number(item.discount) || 0,
          image: ''
        }));

        return {
          ...prev,
          currency: parsedData.currency || prev.currency,
          client: {
            name: parsedData.client?.name || prev.client.name,
            rut: parsedData.client?.rut || prev.client.rut,
            address: parsedData.client?.address || prev.client.address,
            contact: parsedData.client?.contact || prev.client.contact,
          },
          items: formattedItems.length > 0 ? formattedItems : prev.items
        };
      });

      setAiPrompt('');
      setAiStatus({ type: 'success', message: '¡Datos procesados y cargados al documento exitosamente!' });
    } catch (error: any) {
      console.error('Error in Gemini call:', error);
      setAiStatus({ type: 'error', message: `Error de IA: ${error.message || 'No se pudo procesar el texto.'}` });
    } finally {
      setAiLoading(false);
    }
  };

  // AI Polish Notes
  const handleAiPolishNotes = async () => {
    if (!apiKey) {
      setShowKeyInput(true);
      alert('Ingresa una API Key para utilizar la asistencia de IA.');
      return;
    }
    setAiLoading(true);
    try {
      const prompt = `Mejora y formaliza las siguientes notas/condiciones de pago para que suenen extremadamente profesionales, claras y educadas. Conserva los datos importantes como cuentas bancarias, plazos o correos de confirmación.
Notas actuales:
"${data.notes}"

Devuelve únicamente la versión mejorada del texto.`;

      const ai = new GoogleGenAI({ apiKey: apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      if (response.text) {
        setData(d => ({ ...d, notes: response.text.trim() }));
        setAiStatus({ type: 'success', message: 'Notas profesionalizadas por IA.' });
      }
    } catch (e: any) {
      setAiStatus({ type: 'error', message: `Error: ${e.message}` });
    } finally {
      setAiLoading(false);
      setTimeout(() => setAiStatus({ type: '', message: '' }), 3000);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans ${data.theme ? `theme-${data.theme}` : 'theme-classic'}`}>
      
      {/* Premium Application Top Bar */}
      <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-50 px-4 py-3 print:hidden">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-t-primary to-t-primary-light p-2.5 rounded-xl text-white shadow-lg shadow-t-primary/20">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <h1 className="font-outfit text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">BoletaCraft Pro</h1>
              <p className="text-[11px] text-slate-400 font-medium">Facturación y Cobro Inteligente</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={fillMockData}
              className="bg-slate-900 border border-slate-700 hover:border-slate-500 hover:bg-slate-800 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-300"
            >
              <RefreshCw size={13} />
              Cargar Ejemplo
            </button>

            <button 
              onClick={resetData}
              className="bg-slate-900 border border-red-950/50 text-red-400 hover:bg-red-950/20 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Trash2 size={13} />
              Limpiar
            </button>

            <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block" />

            <button
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-slate-200"
            >
              <Printer size={14} />
              Imprimir / PDF Nativo
            </button>

            <button
              onClick={handleExportPDFDirect}
              disabled={aiLoading}
              className="bg-gradient-to-r from-t-primary to-t-primary-light hover:brightness-110 text-white shadow-md shadow-t-primary/10 px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-55"
            >
              {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Descargar PDF
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Layout */}
      <div className="flex-1 w-full max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">

        {/* ============================================== */}
        {/* LEFT COLUMN: CONTROL PANEL & EDITORS           */}
        {/* ============================================== */}
        <aside className="col-span-12 lg:col-span-5 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col h-auto lg:h-[calc(100vh-61px)] bg-slate-950/40 relative print:hidden">

          {/* Quick Mode / Advanced Mode Toggle for Mobile only */}
          <div className="lg:hidden p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center gap-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Modo de Emisión</span>
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setMobileQuickMode(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mobileQuickMode ? 'bg-t-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Rápido
              </button>
              <button
                onClick={() => setMobileQuickMode(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${!mobileQuickMode ? 'bg-t-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Avanzado
              </button>
            </div>
          </div>

          {/* Editor Sub-Tabs Navigation */}
          <div className={`mobile-tab-list flex border-b border-slate-800 bg-slate-950 overflow-x-auto custom-scrollbar shrink-0 ${mobileQuickMode ? 'hidden lg:flex' : 'flex'}`}>
            <button 
              onClick={() => setActiveTab('documento')}
              className={`px-4 py-3 text-xs font-bold shrink-0 flex items-center gap-1.5 border-b-2 transition-all ${activeTab === 'documento' ? 'border-t-primary text-t-primary-light bg-slate-900/40' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <FileText size={14} />
              Documento
            </button>
            <button 
              onClick={() => setActiveTab('emisor_receptor')}
              className={`px-4 py-3 text-xs font-bold shrink-0 flex items-center gap-1.5 border-b-2 transition-all ${activeTab === 'emisor_receptor' ? 'border-t-primary text-t-primary-light bg-slate-900/40' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <User size={14} />
              Emisor/Receptor
            </button>
            <button 
              onClick={() => setActiveTab('items')}
              className={`px-4 py-3 text-xs font-bold shrink-0 flex items-center gap-1.5 border-b-2 transition-all ${activeTab === 'items' ? 'border-t-primary text-t-primary-light bg-slate-900/40' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <Plus size={14} />
              Ítems ({data.items.length})
            </button>
            <button 
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-3 text-xs font-bold shrink-0 flex items-center gap-1.5 border-b-2 transition-all ${activeTab === 'ai' ? 'border-t-primary text-t-primary-light bg-slate-900/40 animate-pulse' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <Sparkles size={14} className="text-purple-400" />
              Asistente IA
            </button>
            <button 
              onClick={() => setActiveTab('historial')}
              className={`px-4 py-3 text-xs font-bold shrink-0 flex items-center gap-1.5 border-b-2 transition-all ${activeTab === 'historial' ? 'border-t-primary text-t-primary-light bg-slate-900/40' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <History size={14} />
              Historial
            </button>
          </div>

          {/* Editor Form Container */}
          <div className="flex-1 lg:overflow-y-auto p-5 custom-scrollbar space-y-5 text-sm h-auto lg:h-full">
            
            {/* Status alerts */}
            {aiStatus.message && (
              <div className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 ${aiStatus.type === 'success' ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300' : 'bg-red-950/30 border-red-800 text-red-300'}`}>
                <Info size={14} />
                <span>{aiStatus.message}</span>
              </div>
            )}

            {isMobile && mobileQuickMode ? (
              <div className="space-y-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider mb-2">Boleta Rápida</h3>
                  
                  {/* Tipo de Documento */}
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">Tipo de Documento</label>
                    <select
                      value={data.documentType}
                      onChange={(e: any) => handleDocumentTypeChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-base"
                    >
                      <option value="factura">Factura Afecta (+ 19% IVA)</option>
                      <option value="boleta_venta">Boleta de Ventas (IVA Incluido)</option>
                      <option value="boleta_honorarios">Boleta de Honorarios (SII Retención 13.75%)</option>
                      <option value="recibo">Recibo Simple (Sin Impuesto)</option>
                    </select>
                  </div>

                  {/* Nombre Cliente */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Razón Social / Nombre Cliente</label>
                    <input 
                      type="text" 
                      value={data.client.name} 
                      onChange={(e) => updateClient('name', e.target.value)}
                      placeholder="Empresa Cliente S.A."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-base" 
                    />
                  </div>

                  {/* RUT Cliente */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">RUT Cliente</label>
                    <input 
                      type="text" 
                      value={data.client.rut} 
                      onChange={(e) => updateClient('rut', e.target.value)}
                      placeholder="78.999.888-7"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-base" 
                    />
                  </div>
                </div>

                {/* Detalle del Cobro */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider mb-2">Detalle del Cobro</h3>
                  
                  {/* Descripción */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Descripción del Servicio</label>
                    <input
                      type="text"
                      value={data.items[0]?.description || ''}
                      onChange={(e) => {
                        const firstItemId = data.items[0]?.id || '1';
                        updateItem(firstItemId, 'description', e.target.value);
                      }}
                      placeholder="Ej. Honorarios de asesoría mensual"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-base"
                    />
                  </div>

                  {/* Monto */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Monto ($)</label>
                    <input 
                      type="number"
                      value={data.items[0]?.unitPrice === '' || data.items[0]?.unitPrice === 0 ? '' : data.items[0]?.unitPrice}
                      onChange={(e) => {
                        const firstItemId = data.items[0]?.id || '1';
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        updateItem(firstItemId, 'unitPrice', val);
                      }}
                      placeholder="0"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-base"
                    />
                  </div>
                </div>

                {/* Botones de acción principales */}
                <div className="pt-2 flex flex-col gap-3">
                  <button
                    onClick={handleExportPDFDirect}
                    disabled={aiLoading}
                    className="w-full bg-gradient-to-r from-t-primary to-t-primary-light text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg"
                  >
                    {aiLoading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    <span>Descargar PDF</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 font-semibold h-12 rounded-xl flex items-center justify-center gap-2"
                  >
                    <Printer size={18} />
                    <span>Imprimir / PDF Nativo</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
            {activeTab === 'documento' && (
              <div className="space-y-4">
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider mb-2">Configuración General</h3>
                  
                  {/* Document Type Selector */}
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">Tipo de Documento</label>
                    <select
                      value={data.documentType}
                      onChange={(e: any) => handleDocumentTypeChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200"
                    >
                      <option value="factura">Factura Afecta (+ 19% IVA)</option>
                      <option value="boleta_venta">Boleta de Ventas (IVA Incluido)</option>
                      <option value="boleta_honorarios">Boleta de Honorarios (SII Retención 13.75%)</option>
                      <option value="recibo">Recibo Simple (Sin Impuesto)</option>
                    </select>
                  </div>

                  {/* Currency Selector */}
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">Moneda</label>
                    <select
                      value={data.currency}
                      onChange={(e) => setData(d => ({ ...d, currency: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200"
                    >
                      <option value="CLP">CLP ($) - Peso Chileno</option>
                      <option value="USD">USD ($) - Dólar Americano</option>
                      <option value="EUR">EUR (€) - Euro</option>
                      <option value="UF">UF - Unidad de Fomento</option>
                    </select>
                  </div>

                  {/* Theme Selector */}
                  <div>
                    <label className="text-xs text-slate-400 font-semibold block mb-1">Plantilla de Color / Estilo</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                      <button 
                        onClick={() => setData(d => ({ ...d, theme: 'classic' }))}
                        className={`flex items-center justify-between border rounded-lg p-2.5 transition-all text-xs font-semibold ${data.theme === 'classic' ? 'border-blue-500 bg-blue-950/20 text-blue-300' : 'border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400'}`}
                      >
                        <span>Azul Clásico</span>
                        <span className="w-3.5 h-3.5 rounded-full bg-blue-700 border border-white/20" />
                      </button>
                      
                      <button 
                        onClick={() => setData(d => ({ ...d, theme: 'emerald' }))}
                        className={`flex items-center justify-between border rounded-lg p-2.5 transition-all text-xs font-semibold ${data.theme === 'emerald' ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300' : 'border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400'}`}
                      >
                        <span>Verde Moderno</span>
                        <span className="w-3.5 h-3.5 rounded-full bg-emerald-700 border border-white/20" />
                      </button>

                      <button 
                        onClick={() => setData(d => ({ ...d, theme: 'minimalist' }))}
                        className={`flex items-center justify-between border rounded-lg p-2.5 transition-all text-xs font-semibold ${data.theme === 'minimalist' ? 'border-zinc-500 bg-zinc-950/20 text-zinc-300' : 'border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400'}`}
                      >
                        <span>Charcoal Mínimo</span>
                        <span className="w-3.5 h-3.5 rounded-full bg-zinc-700 border border-white/20" />
                      </button>

                      <button 
                        onClick={() => setData(d => ({ ...d, theme: 'violet' }))}
                        className={`flex items-center justify-between border rounded-lg p-2.5 transition-all text-xs font-semibold ${data.theme === 'violet' ? 'border-purple-500 bg-purple-950/20 text-purple-300' : 'border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400'}`}
                      >
                        <span>Violet Creativo</span>
                        <span className="w-3.5 h-3.5 rounded-full bg-purple-700 border border-white/20" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider mb-2">Metadatos del Documento</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">N° de Documento</label>
                      <input 
                        type="text" 
                        value={data.info.number} 
                        onChange={(e) => updateInfo('number', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Fecha Emisión</label>
                      <input 
                        type="text" 
                        value={data.info.date} 
                        onChange={(e) => updateInfo('date', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Título del Documento</label>
                    <input 
                      type="text" 
                      value={data.info.type} 
                      onChange={(e) => updateInfo('type', e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Forma de Pago</label>
                    <input 
                      type="text" 
                      value={data.info.paymentMethod} 
                      onChange={(e) => updateInfo('paymentMethod', e.target.value)}
                      placeholder="Ej. Transferencia Bancaria, Webpay"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: COMPANY & CLIENT */}
            {activeTab === 'emisor_receptor' && (
              <div className="space-y-4">
                
                {/* Issuer Info */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">Detalles del Emisor (Tú)</h3>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Razón Social / Nombre Emisor</label>
                    <input 
                      type="text" 
                      value={data.company.name} 
                      onChange={(e) => updateCompany('name', e.target.value)}
                      placeholder="Tu Empresa SpA"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">RUT Emisor</label>
                      <input 
                        type="text" 
                        value={data.company.rut} 
                        onChange={(e) => updateCompany('rut', e.target.value)}
                        placeholder="76.123.456-7"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Giro de Actividad</label>
                      <input 
                        type="text" 
                        value={data.company.activity || ''} 
                        onChange={(e) => updateCompany('activity', e.target.value)}
                        placeholder="Servicios informáticos"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Dirección Comercial</label>
                    <input 
                      type="text" 
                      value={data.company.address} 
                      onChange={(e) => updateCompany('address', e.target.value)}
                      placeholder="Av. Providencia 123, Of 5"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Logo Emisor (Imagen Base64 / URL)</label>
                    <div className="flex gap-3 items-center mt-1">
                      {data.company.logo ? (
                        <div className="relative group w-12 h-12 bg-white rounded border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                          <img src={data.company.logo} alt="Company Logo Thumbnail" className="w-full h-full object-contain" />
                          <button 
                            onClick={() => updateCompany('logo', '')}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-slate-950 rounded border border-dashed border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                          <Building size={18} />
                        </div>
                      )}
                      <label className="flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg py-2 px-3 text-center text-xs font-semibold text-slate-300 cursor-pointer transition-colors">
                        Subir Imagen
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, (url) => updateCompany('logo', url))}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Client Info */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">Detalles del Receptor (Cliente)</h3>
                    <button 
                      onClick={saveClient}
                      className="text-t-primary-light hover:text-white text-xs font-semibold flex items-center gap-1"
                    >
                      <Save size={12} />
                      Guardar Cliente
                    </button>
                  </div>

                  {savedClients.length > 0 && (
                    <div>
                      <label className="text-[11px] text-slate-500 font-semibold block mb-1">Seleccionar Cliente Guardado</label>
                      <select 
                        onChange={(e) => {
                          const client = savedClients.find(c => c.id === e.target.value);
                          if (client) loadClient(client);
                        }}
                        defaultValue=""
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 mb-2 focus:outline-none"
                      >
                        <option value="" disabled>-- Elegir de la base de datos --</option>
                        {savedClients.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.rut || 'Sin Rut'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Razón Social / Nombre Cliente</label>
                    <input 
                      type="text" 
                      value={data.client.name} 
                      onChange={(e) => updateClient('name', e.target.value)}
                      placeholder="Empresa Cliente S.A."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">RUT Cliente</label>
                      <input 
                        type="text" 
                        value={data.client.rut} 
                        onChange={(e) => updateClient('rut', e.target.value)}
                        placeholder="78.999.888-7"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Contacto / Email</label>
                      <input 
                        type="text" 
                        value={data.client.contact} 
                        onChange={(e) => updateClient('contact', e.target.value)}
                        placeholder="contacto@cliente.cl"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Dirección Cliente</label>
                    <input 
                      type="text" 
                      value={data.client.address} 
                      onChange={(e) => updateClient('address', e.target.value)}
                      placeholder="Calle Principal #456, Santiago"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                    />
                  </div>

                  {savedClients.length > 0 && (
                    <div className="pt-2 border-t border-slate-900 mt-2">
                      <label className="text-[10px] text-slate-500 block mb-1">Administrar Clientes Guardados</label>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                        {savedClients.map(c => (
                          <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-md py-1 px-2 flex items-center gap-1.5 text-[11px]">
                            <span className="text-slate-300 max-w-[120px] truncate">{c.name}</span>
                            <button 
                              onClick={(e) => deleteClient(c.id, e)}
                              className="text-red-400 hover:text-red-300"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB 3: ITEMS LIST & ADD */}
            {activeTab === 'items' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-xs uppercase tracking-wider">Listado de Ítems ({data.items.length})</h3>
                  <button 
                    onClick={addItem}
                    className="bg-t-primary hover:bg-t-primary-light text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <Plus size={14} />
                    Agregar Fila
                  </button>
                </div>

                <div className="space-y-3">
                  {data.items.map((item, index) => (
                    <div 
                      key={item.id}
                      className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3 relative group/item"
                    >
                      {/* Drag & Drop simulated order controls */}
                      <div className="absolute right-3 top-3 flex gap-1 print:hidden opacity-50 group-hover/item:opacity-100 transition-opacity">
                        <button
                          disabled={index === 0}
                          onClick={() => moveItem(index, 'up')}
                          className="bg-slate-950 border border-slate-800 p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          disabled={index === data.items.length - 1}
                          onClick={() => moveItem(index, 'down')}
                          className="bg-slate-950 border border-slate-800 p-1 rounded text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-400"
                        >
                          <ChevronDown size={14} />
                        </button>
                        {data.items.length > 1 && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="bg-slate-950 border border-red-950/40 p-1 rounded text-red-400 hover:text-red-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>

                      <div className="pr-16">
                        <label className="text-[11px] text-slate-500 font-bold block mb-1">Ítem #{index + 1}</label>
                        <textarea
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          placeholder="Descripción detallada del producto o servicio..."
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-xs resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Cantidad</label>
                          <input 
                            type="number"
                            value={item.quantity === '' ? '' : item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="1"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">P. Unitario</label>
                          <input 
                            type="number"
                            value={item.unitPrice === '' ? '' : item.unitPrice}
                            onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">Desc. Línea</label>
                          <input 
                            type="number"
                            value={item.discount === '' ? '' : item.discount}
                            onChange={(e) => updateItem(item.id, 'discount', e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-xs"
                          />
                        </div>
                      </div>

                      {/* Product Row Image (Optional) */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Imagen del Ítem (Opcional)</label>
                        <div className="flex gap-2 items-center">
                          {item.image ? (
                            <div className="relative group w-10 h-10 bg-white rounded border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                              <img src={item.image} alt="Item" className="w-full h-full object-cover" />
                              <button 
                                onClick={() => updateItem(item.id, 'image', '')}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity"
                              >
                                &times;
                              </button>
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-slate-950 rounded border border-dashed border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                              <ImageIcon size={14} />
                            </div>
                          )}
                          <label className="bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg py-1.5 px-3 text-center text-[11px] font-semibold text-slate-300 cursor-pointer transition-colors flex-1">
                            Subir Imagen de Producto
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => handleImageUpload(e, (url) => updateItem(item.id, 'image', url))}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Global discount & Notes */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider mb-2">Descuentos y Condiciones</h3>
                  
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Descuento Global (Monto Fijo)</label>
                    <input 
                      type="number"
                      value={data.globalDiscount === '' ? '' : data.globalDiscount}
                      onChange={(e) => setData(d => ({ ...d, globalDiscount: e.target.value === '' ? '' : Number(e.target.value) }))}
                      placeholder="0"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200" 
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-slate-400 block">Notas, Datos Bancarios u Observaciones</label>
                      <button 
                        onClick={handleAiPolishNotes}
                        disabled={aiLoading}
                        className="text-purple-400 hover:text-purple-300 text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50"
                      >
                        <Sparkles size={11} />
                        Pulir con IA
                      </button>
                    </div>
                    <textarea 
                      value={data.notes}
                      onChange={(e) => setData(d => ({ ...d, notes: e.target.value }))}
                      placeholder="Banco, Cuenta, Detalles de contacto..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-xs resize-none" 
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Saludo / Pie de página</label>
                    <input 
                      type="text" 
                      value={data.footer.greeting} 
                      onChange={(e) => updateFooter('greeting', e.target.value)}
                      placeholder="Gracias por su preferencia."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-xs" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: GEMINI AI ASSISTANT */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                
                {/* Api Key Banner */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-purple-300 flex items-center gap-2 text-xs uppercase tracking-wider">
                      <Sparkles size={14} />
                      Conexión Inteligente
                    </h3>
                    <button 
                      onClick={() => setShowKeyInput(!showKeyInput)}
                      className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
                    >
                      <Key size={12} />
                      {apiKey ? 'Cambiar API Key' : 'Configurar API Key'}
                    </button>
                  </div>
                  
                  {(!apiKey || showKeyInput) && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
                      <p className="text-[11px] text-slate-400 leading-normal">
                        Para habilitar la IA de auto-rellenado y pulido de datos, introduce tu Gemini API Key. Las claves se guardan localmente en tu navegador.
                      </p>
                      <div className="flex gap-2">
                        <input 
                          type="password"
                          placeholder="AIzaSy..."
                          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-200"
                          id="apiKeyInput"
                        />
                        <button 
                          onClick={() => {
                            const input = document.getElementById('apiKeyInput') as HTMLInputElement;
                            if (input) saveApiKey(input.value);
                          }}
                          className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Guardar
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        ¿No tienes una? Consíguela gratis en <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">Google AI Studio</a>.
                      </p>
                    </div>
                  )}
                  {apiKey && !showKeyInput && (
                    <div className="text-[11px] text-emerald-400 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-900/30 flex items-center justify-between">
                      <span>✓ Asistente Gemini API conectado y listo</span>
                      <span className="text-[9px] bg-emerald-900/50 text-emerald-300 py-0.5 px-2 rounded-full uppercase font-bold">Activo</span>
                    </div>
                  )}
                </div>

                {/* Autofill box */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Relleno de Cobro por Texto Natural</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Escribe los detalles de forma libre (ej: *"Cobrar a Carlos Ruiz rut 19230910-2 por un diseño de banner a $45.000 y 3 horas de asesoría a $15.000 la hora"*). Gemini se encargará de extraer e inyectar el cliente y las filas correspondientes.
                  </p>
                  
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Escribe la descripción de la boleta o factura aquí..."
                    rows={4}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-1 focus:ring-t-primary text-slate-200 text-xs resize-none"
                  />

                  <button
                    onClick={handleAiFill}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:brightness-110 disabled:opacity-40 text-white py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-950/10"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Procesando datos con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Auto-rellenar Documento</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Email Draft box */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Generar Email de Cobro</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Genera un mensaje de acompañamiento para enviar al cliente adjuntando esta boleta.
                  </p>
                  <button
                    onClick={async () => {
                      if (!apiKey) {
                        setShowKeyInput(true);
                        alert('Ingresa una API Key para utilizar la IA.');
                        return;
                      }
                      setAiLoading(true);
                      try {
                        const prompt = `Genera un borrador de correo electrónico formal para enviar una factura o boleta de cobro.
Detalles del documento:
- Tipo: ${getDocumentTypeName(data.documentType)}
- Número: ${data.info.number}
- Emisor: ${data.company.name}
- Cliente: ${data.client.name}
- Total: ${formatCurrency(finalTotal)}

Devuelve solo el texto del correo, incluyendo el Asunto y el Cuerpo de forma pulida.`;

                        const ai = new GoogleGenAI({ apiKey: apiKey });
                        const response = await ai.models.generateContent({
                          model: 'gemini-2.5-flash',
                          contents: prompt
                        });
                        if (response.text) {
                          alert(`Borrador de Correo Generado:\n\n${response.text}`);
                        }
                      } catch (e: any) {
                        alert(`Error: ${e.message}`);
                      } finally {
                        setAiLoading(false);
                      }
                    }}
                    disabled={aiLoading}
                    className="w-full bg-slate-950 border border-slate-850 hover:bg-slate-900 text-slate-300 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Mail size={14} className="text-purple-400" />
                    <span>Redactar Email con IA</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: SAVED DRAFTS & LOCAL STORAGE */}
            {activeTab === 'historial' && (
              <div className="space-y-4">
                
                {/* Save current draft box */}
                <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Guardar Documento Actual</h3>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Nombre del borrador (ej: Factura ACME Mayo)"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-200 focus:outline-none"
                    />
                    <button
                      onClick={saveDraft}
                      className="bg-t-primary hover:bg-t-primary-light text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
                    >
                      Guardar
                    </button>
                  </div>
                </div>

                {/* History list */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Borradores Guardados ({savedDrafts.length})</h3>
                  {savedDrafts.length === 0 ? (
                    <div className="text-center p-6 bg-slate-900/20 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                      No tienes borradores guardados en este navegador.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                      {savedDrafts.map(d => (
                        <div
                          key={d.id}
                          onClick={() => loadDraft(d)}
                          className="bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 rounded-xl p-3 flex justify-between items-center cursor-pointer transition-all"
                        >
                          <div className="space-y-1">
                            <h4 className="font-semibold text-slate-200 text-xs">{d.name}</h4>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span>{getDocumentTypeName(d.data.documentType)}</span>
                              <span>•</span>
                              <span>{d.date}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => deleteDraft(d.id, e)}
                            className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

          {/* Quick tips footer in sidebar */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/70 text-slate-500 text-[11px] flex items-start gap-2 shrink-0">
            <Info size={14} className="text-t-primary-light shrink-0 mt-0.5" />
            <p className="leading-normal">
              También puedes hacer clic y editar directamente los campos de texto sobre la hoja de vista previa a la derecha.
            </p>
          </div>
        </aside>

        {/* ============================================== */}
        {/* RIGHT COLUMN: LIVE PDF PAPER PREVIEW           */}
        {/* ============================================== */}
        <main className="col-span-12 lg:col-span-7 flex flex-col bg-slate-900 p-4 sm:p-8 md:p-12 h-auto lg:h-[calc(100vh-61px)] lg:overflow-y-auto items-center justify-start print:bg-white print:p-0 print:h-auto print:overflow-visible w-full">
          
          {/* Scaled preview container for mobile adaptability */}
          <div 
            ref={containerRef}
            className="w-full flex justify-center items-start overflow-hidden print:overflow-visible print:h-auto"
            style={{ 
              height: scale < 1 ? `${paperHeight * scale}px` : 'auto'
            }}
          >
            {/* Virtual Sheet of Paper Container */}
            <div 
              ref={paperRef}
              id="receipt-paper"
              className="w-[816px] min-h-[1056px] bg-white text-slate-900 shadow-2xl relative flex flex-col justify-between print:shadow-none print:w-full print:max-w-none print:min-h-0 overflow-hidden rounded-md print:rounded-none shrink-0"
              style={{
                transform: scale < 1 ? `scale(${scale})` : 'none',
                transformOrigin: 'top center'
              }}
            >
            
            {/* Elegant watermark */}
            <div className="absolute inset-0 bg-white z-0 pointer-events-none flex items-center justify-center overflow-hidden">
              {data.company.logo && (
                <img 
                  src={data.company.logo} 
                  alt="Watermark Logo" 
                  className="absolute w-[50%] max-w-[380px] object-contain filter grayscale opacity-[0.06] pointer-events-none z-0 mix-blend-multiply" 
                />
              )}
            </div>

            {/* Document Decorative Top Bar */}
            <div className="h-2.5 w-full bg-t-primary shrink-0 relative z-10" />

            {/* Content Body of Receipt */}
            <div className="p-8 sm:p-12 print:p-6 flex-1 flex flex-col justify-between relative z-10 space-y-8 print:space-y-6">
              
              {/* Header section */}
              <div className="space-y-6">
                
                {/* Logo & Document Identity */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-t-border pb-6 print:flex-row">
                  
                  {/* Left: Company Logo and Name */}
                  <div className="flex items-start gap-4 flex-1">
                    <div className="relative group w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                      {data.company.logo ? (
                        <img src={data.company.logo} alt="Company Logo" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-slate-300 flex flex-col items-center">
                          <Hexagon strokeWidth={1} size={36} className="text-t-primary/20" />
                          <span className="text-[9px] uppercase font-bold mt-1 tracking-wider text-slate-400">Logo</span>
                        </div>
                      )}
                      
                      <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer print:hidden">
                        <ImageIcon className="text-white" size={20} />
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(e, (url) => updateCompany('logo', url))}
                        />
                      </label>
                    </div>

                    <div className="space-y-1 flex-1">
                      <EditableText
                        value={data.company.name}
                        onChange={(val: string) => updateCompany('name', val)}
                        className="font-outfit text-2xl font-bold tracking-tight text-t-primary leading-tight placeholder-slate-300 w-full uppercase"
                        placeholder="Razón Social Empresa"
                      />
                      <EditableText
                        value={data.company.activity}
                        onChange={(val: string) => updateCompany('activity', val)}
                        className="text-xs text-slate-500 font-medium block placeholder-slate-300 w-full"
                        placeholder="Giro de la empresa"
                      />
                      <EditableText
                        value={data.company.address}
                        onChange={(val: string) => updateCompany('address', val)}
                        className="text-[11px] text-slate-400 block placeholder-slate-300 w-full leading-normal"
                        placeholder="Dirección del emisor"
                      />
                    </div>
                  </div>

                  {/* Right: Rut & Number & Date Bordered Box (SII style but modern) */}
                  <div className="w-full sm:w-[260px] border-2 border-red-500 rounded-xl p-4 flex flex-col items-center text-center justify-center bg-white shrink-0 space-y-1.5 print:w-[240px]">
                    <span className="text-[11px] font-bold text-red-500 uppercase tracking-widest leading-none">R.U.T.: {data.company.rut || '76.123.456-7'}</span>
                    
                    <EditableText
                      value={data.info.type}
                      onChange={(val: string) => updateInfo('type', val)}
                      className="font-outfit text-sm font-bold text-red-500 tracking-tight placeholder-slate-300 w-full uppercase text-center leading-none"
                      placeholder="Factura Electrónica"
                    />

                    <div className="flex items-center gap-1.5">
                      <span className="text-red-500 font-bold text-xs uppercase leading-none">N°:</span>
                      <EditableText
                        value={data.info.number}
                        onChange={(val: string) => updateInfo('number', val)}
                        className="text-lg font-extrabold text-red-500 placeholder-slate-300 w-24 text-center py-0"
                        placeholder="0001"
                      />
                    </div>

                    <div className="pt-1.5 border-t border-red-100 w-full flex items-center justify-center gap-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Fecha:</span>
                      <EditableText
                        value={data.info.date}
                        onChange={(val: string) => updateInfo('date', val)}
                        className="text-[11px] font-bold text-slate-700 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Parties details - Client Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-t-accent-bg/40 border border-t-border rounded-xl p-5 sm:p-6 print:grid-cols-2 print:p-4 print-card-border">
                  
                  {/* Left: Client info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-t-primary-light uppercase tracking-wider block">Señor(es):</span>
                    </div>
                    <EditableText
                      value={data.client.name}
                      onChange={(val: string) => updateClient('name', val)}
                      className="font-outfit text-base font-bold text-t-text placeholder-slate-300 w-full block leading-none"
                      placeholder="Razón Social Cliente"
                    />
                    
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">R.U.T:</span>
                      <EditableText
                        value={data.client.rut}
                        onChange={(val: string) => updateClient('rut', val)}
                        className="text-xs font-semibold text-slate-700 w-full"
                        placeholder="78.123.456-7"
                      />
                    </div>
                  </div>

                  {/* Right: Client contact & address */}
                  <div className="space-y-1.5 sm:border-l border-t-border sm:pl-6 print:border-l print:pl-6 print:space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Contacto y Envío:</span>
                    
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-slate-400 shrink-0" />
                      <EditableText
                        value={data.client.contact}
                        onChange={(val: string) => updateClient('contact', val)}
                        className="text-xs text-slate-600 w-full"
                        placeholder="correo@cliente.cl"
                      />
                    </div>

                    <div className="flex items-start gap-2">
                      <Globe size={12} className="text-slate-400 shrink-0 mt-0.5" />
                      <EditableText
                        value={data.client.address}
                        onChange={(val: string) => updateClient('address', val)}
                        className="text-xs text-slate-600 w-full"
                        placeholder="Dirección del cliente"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Items Table container */}
              <div className="flex-1 space-y-4">
                <div className="w-full overflow-hidden border border-t-border rounded-xl print-card-border">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-t-primary text-white font-semibold">
                        <th className="py-3 px-4 font-outfit uppercase tracking-wider text-[10px]">Descripción del Servicio / Producto</th>
                        <th className="py-3 px-3 font-outfit uppercase tracking-wider text-[10px] text-right w-24">Precio Unit.</th>
                        <th className="py-3 px-3 font-outfit uppercase tracking-wider text-[10px] text-center w-16">Cant.</th>
                        <th className="py-3 px-3 font-outfit uppercase tracking-wider text-[10px] text-right w-20">Desc.</th>
                        <th className="py-3 px-4 font-outfit uppercase tracking-wider text-[10px] text-right w-28">Total Línea</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-t-border">
                      {data.items.map((item) => {
                        const qty = Number(item.quantity) || 0;
                        const price = Number(item.unitPrice) || 0;
                        const itemDisc = Number(item.discount) || 0;
                        const totalLinea = (qty * price) - itemDisc;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4 flex items-start gap-3">
                              {item.image && (
                                <img src={item.image} alt="Product row preview" className="w-9 h-9 object-cover rounded border border-slate-200 bg-white shrink-0 mt-0.5" />
                              )}
                              <EditableText
                                value={item.description}
                                onChange={(val: string) => updateItem(item.id, 'description', val)}
                                multiline
                                className="text-slate-800 font-medium placeholder-slate-300 w-full"
                                placeholder="Servicio realizado..."
                              />
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                              <EditableNumber
                                value={item.unitPrice}
                                onChange={(val: number | '') => updateItem(item.id, 'unitPrice', val)}
                                className="text-right w-full text-slate-700"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-3 px-3 text-center tabular-nums text-slate-700">
                              <EditableNumber
                                value={item.quantity}
                                onChange={(val: number | '') => updateItem(item.id, 'quantity', val)}
                                className="text-center w-full text-slate-700"
                                placeholder="1"
                              />
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-red-600">
                              <EditableNumber
                                value={item.discount}
                                onChange={(val: number | '') => updateItem(item.id, 'discount', val)}
                                className="text-right w-full text-red-600 font-semibold"
                                placeholder="0"
                              />
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-semibold text-slate-900">
                              {formatCurrency(totalLinea)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Floating controls under table in preview screen only */}
                <button 
                  onClick={addItem}
                  className="mt-2 text-xs font-bold text-t-primary hover:text-t-primary-light flex items-center gap-1 bg-t-accent-bg py-2 px-3 rounded-lg border border-t-primary/10 transition-colors print:hidden"
                >
                  <Plus size={14} />
                  Añadir nueva fila
                </button>
              </div>

              {/* Footer Section: Notes & Totals */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-6 border-t border-t-border print:grid-cols-2 print:gap-6 print:pt-4">
                
                {/* Notes & Payment Terms */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-t-border pb-1.5">
                    <span className="text-[10px] font-bold text-t-primary-light uppercase tracking-wider">Forma de pago:</span>
                    <EditableText
                      value={data.info.paymentMethod}
                      onChange={(val: string) => updateInfo('paymentMethod', val)}
                      className="text-xs text-slate-700 font-semibold w-full max-w-[200px]"
                      placeholder="Ej. Transferencia"
                    />
                  </div>
                  
                  {data.notes && (
                    <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-600 leading-relaxed print:bg-transparent print:border-none print:p-0">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Notas / Instrucciones adicionales:</span>
                      <EditableText
                        value={data.notes}
                        onChange={(val: string) => setData(d => ({ ...d, notes: val }))}
                        multiline
                        className="text-slate-600 placeholder-slate-300 w-full"
                        placeholder="Detalles adicionales..."
                      />
                    </div>
                  )}
                </div>

                {/* Totals engine */}
                <div className="flex justify-end">
                  <div className="w-full max-w-[300px] divide-y divide-slate-100 text-xs">
                    
                    <div className="flex justify-between items-center py-2 px-1">
                      <span className="text-slate-500 font-medium">Subtotal</span>
                      <span className="text-slate-900 tabular-nums font-medium">{formatCurrency(subtotalNeto)}</span>
                    </div>

                    {rawGlobalDiscount > 0 && (
                      <div className="flex justify-between items-center py-2 px-1 text-red-600">
                        <span className="font-medium">Descuento Global</span>
                        <span className="tabular-nums font-semibold">- {formatCurrency(rawGlobalDiscount)}</span>
                      </div>
                    )}

                    {data.documentType !== 'recibo' && (
                      <div className="flex justify-between items-center py-2 px-1">
                        <span className="text-slate-500 font-medium">
                          {data.documentType === 'boleta_honorarios' ? 'Base Bruta' : 'Monto Neto'}
                        </span>
                        <span className="text-slate-900 tabular-nums font-medium">{formatCurrency(baseMonto)}</span>
                      </div>
                    )}

                    {taxValue > 0 && (
                      <div className="flex justify-between items-center py-2 px-1">
                        <span className="text-slate-500 font-medium">{taxName}</span>
                        <span className="text-slate-900 tabular-nums font-medium">
                          {data.documentType === 'boleta_honorarios' ? `- ${formatCurrency(taxValue)}` : formatCurrency(taxValue)}
                        </span>
                      </div>
                    )}

                    {/* Total Pay block */}
                    <div className="flex justify-between items-center py-3.5 px-3 bg-t-primary text-white rounded-xl mt-3 shadow-md shadow-t-primary/10 print:shadow-none overflow-hidden print:bg-t-primary print:text-white">
                      <span className="font-outfit text-xs font-bold uppercase tracking-wider">
                        {data.documentType === 'boleta_honorarios' ? 'Total Líquido' : 'Total a Pagar'}
                      </span>
                      <span className="font-outfit text-base font-extrabold tabular-nums tracking-tight">
                        {formatCurrency(finalTotal)}
                      </span>
                    </div>

                  </div>
                </div>

              </div>

            </div>

            {/* Premium Document Footer Contact bar */}
            <footer className="border-t border-t-border bg-slate-50/50 py-5 px-8 flex flex-col items-center gap-4 shrink-0 z-10 print:bg-transparent print:px-6 print:py-4">
              
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-8 w-full text-slate-500 text-[10px] font-semibold print:flex-row">
                {data.footer.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={12} className="text-t-primary-light" />
                    <EditableText
                      value={data.footer.phone}
                      onChange={(val: string) => updateFooter('phone', val)}
                      className="placeholder-slate-300 text-center"
                      placeholder="Teléfono"
                    />
                  </div>
                )}
                {data.footer.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={12} className="text-t-primary-light" />
                    <EditableText
                      value={data.footer.email}
                      onChange={(val: string) => updateFooter('email', val)}
                      className="placeholder-slate-300 text-center"
                      placeholder="Email"
                    />
                  </div>
                )}
                {data.footer.website && (
                  <div className="flex items-center gap-1.5">
                    <Globe size={12} className="text-t-primary-light" />
                    <EditableText
                      value={data.footer.website}
                      onChange={(val: string) => updateFooter('website', val)}
                      className="placeholder-slate-300 text-center"
                      placeholder="Sitio Web"
                    />
                  </div>
                )}
              </div>
              
              <div className="w-full text-center">
                <EditableText
                  value={data.footer.greeting}
                  onChange={(val: string) => updateFooter('greeting', val)}
                  className="text-slate-800 font-bold text-xs placeholder-slate-300 w-full text-center tracking-tight"
                  placeholder="Mensaje de saludo"
                />
              </div>
            </footer>
          </div>
        </div>

      </main>
    </div>
  </div>
  );
}
