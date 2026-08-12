'use client';

import * as XLSX from 'xlsx';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  Plus, 
  Edit2, 
  Trash2, 
  CalendarDays, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  Layers, 
  ClipboardCheck, 
  ArrowRight, 
  RefreshCw, 
  X, 
  ShieldAlert, 
  User,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { hasPermission } from '@/lib/permissions';
import { 
  getCategoriesAction, 
  saveCategoryAction, 
  getProductsAction, 
  addProductAction, 
  updateProductAction, 
  deleteProductAction, 
  deliverBulkProductsAction, 
  issueProductAction, 
  startInventoryAction, 
  saveInventoryDraftAction, 
  submitInventoryAction, 
  getInventoryHistoryAction, 
  getInventoryDetailsAction, 
  cancelInventoryAction,
  getWarehouseDashboardAction, 
  getWarehouseHistoryAction,
  getWarehousePresetsAction,
  importBulkProductsAction,
  clearWarehouseHistoryAction
} from '@/app/actions/inventoryActions';

export default function WarehousePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'deliveries' | 'issues' | 'inventories' | 'categories' | 'history'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dane magazynowe
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>({
    totalProductsCount: 0,
    lowStockCount: 0,
    lowStockList: [],
    expiryAlertsCount: 0,
    expiryAlertsList: [],
    recentDeliveries: [],
    recentIssues: [],
    lastInventory: null,
    activeSpotCheckId: null
  });
  const [history, setHistory] = useState<any[]>([]);
  const [inventories, setInventories] = useState<any[]>([]);

  // Filtrowanie katalogu produktów
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('active');
  const [selectedAlertFilter, setSelectedAlertFilter] = useState<'all' | 'low' | 'expiry'>('all');

  // Filtrowanie historii operacji
  const [histProductFilter, setHistProductFilter] = useState('');
  const [histTypeFilter, setHistTypeFilter] = useState('');

  // Stany formularzy modalnych
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null); // null = dodawanie
  const [productForm, setProductForm] = useState({
    name: '',
    categoryId: '',
    supplier: '',
    unit: 'szt.',
    minStock: 0,
    maxStock: 0,
    sku: '',
    location: '',
    hasExpiry: false,
    autoSpotCheck: false,
    remarks: ''
  });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  // Formularz ZBIORCZEJ dostawy
  const [bulkDelivery, setBulkDelivery] = useState({
    supplier: '',
    documentNumber: '',
    remarks: ''
  });
  type BulkItem = { uid: string; productId: number | ''; quantity: number; batchNumber: string; expiryDate: string; };
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([
    { uid: crypto.randomUUID(), productId: '', quantity: 1, batchNumber: '', expiryDate: '' }
  ]);
  const [deliverFile, setDeliverFile] = useState<File | null>(null);
  const [deliverFileWarning, setDeliverFileWarning] = useState(false);

  // Modal szybkiego dodania nowego produktu
  const [quickAddProduct, setQuickAddProduct] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({
    name: '', categoryId: '', unit: 'szt.', supplier: '', hasExpiry: false, minStock: 0, maxStock: 0, location: ''
  });
  const [quickAddTargetUid, setQuickAddTargetUid] = useState<string | null>(null);

  const [showIssueModal, setShowIssueModal] = useState<number | null>(null); // productId
  const [issueForm, setIssueForm] = useState({
    quantity: 1,
    venue: 'Kraków Rynek',
    remarks: ''
  });

  // Stany aktywnej inwentaryzacji
  const [activeInventoryId, setActiveInventoryId] = useState<number | null>(null);
  const [activeInventory, setActiveInventory] = useState<any | null>(null); // { header, items }
  const [inventoryFormValues, setInventoryFormValues] = useState<Record<number, { actualStock: number; remarks: string }>>({});
  const [viewingInventoryDetails, setViewingInventoryDetails] = useState<any | null>(null);

  // Słowniki pobierane z ustawień strony
  const [presetLocations, setPresetLocations] = useState<string[]>([]);
  const [presetSuppliers, setPresetSuppliers] = useState<string[]>([]);
  const [supplierCustom, setSupplierCustom] = useState(false);
  const [locationCustom, setLocationCustom] = useState(false);
  const [bulkSupplierCustom, setBulkSupplierCustom] = useState(false);
  const [quickSupplierCustom, setQuickSupplierCustom] = useState(false);
  const [quickLocationCustom, setQuickLocationCustom] = useState(false);

  // Obsługa customowych dropdownów wyszukiwarki (Combobox) w dostawach
  const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({});
  const [dropdownSearch, setDropdownSearch] = useState<Record<string, string>>({});

  // Szczegółowy modal podglądu operacji historycznej
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);

  // Obsługa importu z Excela
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Ochrona trasy
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const user = session?.user;
      if (!hasPermission(user, 'inventory:view')) {
        router.push('/availability');
      } else {
        loadData();
      }
    }
  }, [status, session, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [categoriesRes, productsRes, dashboardRes, historyRes, inventoriesRes, presetsRes] = await Promise.all([
        getCategoriesAction(),
        getProductsAction(),
        getWarehouseDashboardAction(),
        getWarehouseHistoryAction(),
        getInventoryHistoryAction(),
        getWarehousePresetsAction()
      ]);

      if (categoriesRes.success) setCategories(categoriesRes.data || []);
      if (productsRes.success) setProducts(productsRes.data || []);
      if (dashboardRes.success) setDashboard(dashboardRes.data || {});
      if (historyRes.success) setHistory(historyRes.data || []);
      if (inventoriesRes.success) setInventories(inventoriesRes.data || []);
      if (presetsRes && presetsRes.success) {
        setPresetLocations(presetsRes.locations || []);
        setPresetSuppliers(presetsRes.suppliers || []);
      }
    } catch (e) {
      console.error("Błąd wczytywania danych magazynu:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadData();
    setStatusMsg({ type: 'success', text: 'Zsynchronizowano stany magazynowe.' });
    setTimeout(() => setStatusMsg(null), 3000);
  };

  // -------------------------------------------------------------
  // OPERACJE KATEGORII
  // -------------------------------------------------------------
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setActionLoading(true);
    try {
      const res = await saveCategoryAction(editingCategoryId, newCategoryName);
      if (res.success) {
        setStatusMsg({ type: 'success', text: editingCategoryId ? 'Zmieniono nazwę kategorii.' : 'Dodano nową kategorię.' });
        setNewCategoryName('');
        setEditingCategoryId(null);
        setShowCategoryModal(false);
        const categoriesRes = await getCategoriesAction();
        if (categoriesRes.success) setCategories(categoriesRes.data || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu kategorii.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // -------------------------------------------------------------
  // OPERACJE PRODUKTÓW
  // -------------------------------------------------------------
  const openProductAdd = () => {
    setEditingProduct(null);
    setSupplierCustom(false);
    setLocationCustom(false);
    setProductForm({
      name: '',
      categoryId: categories.length > 0 ? String(categories[0].id) : '',
      supplier: '',
      unit: 'szt.',
      minStock: 0,
      maxStock: 0,
      sku: '',
      location: '',
      hasExpiry: false,
      autoSpotCheck: false,
      remarks: ''
    });
    setShowProductModal(true);
  };

  const openProductEdit = (p: any) => {
    setEditingProduct(p);
    const isSuppCustom = p.supplier && !presetSuppliers.includes(p.supplier);
    const isLocCustom = p.location && !presetLocations.includes(p.location);
    setSupplierCustom(!!isSuppCustom);
    setLocationCustom(!!isLocCustom);
    setProductForm({
      name: p.name,
      categoryId: String(p.categoryId),
      supplier: p.supplier || '',
      unit: p.unit || 'szt.',
      minStock: p.minStock || 0,
      maxStock: p.maxStock || 0,
      sku: p.sku || '',
      location: p.location || '',
      hasExpiry: !!p.hasExpiry,
      autoSpotCheck: !!p.autoSpotCheck,
      remarks: p.remarks || ''
    });
    setShowProductModal(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      let res;
      if (editingProduct) {
        res = await updateProductAction(editingProduct.id, productForm);
      } else {
        res = await addProductAction(productForm);
      }

      if (res.success) {
        setStatusMsg({ type: 'success', text: editingProduct ? 'Zaktualizowano dane produktu.' : 'Dodano nowy produkt do katalogu.' });
        setShowProductModal(false);
        const productsRes = await getProductsAction();
        if (productsRes.success) setProducts(productsRes.data || []);
        const dashRes = await getWarehouseDashboardAction();
        if (dashRes.success) setDashboard(dashRes.data || {});
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu produktu.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("Czy na pewno chcesz dezaktywować ten produkt? Produkt przestanie być widoczny w katalogu, ale jego historia ruchów zostanie zachowana.")) return;
    setActionLoading(true);
    try {
      const res = await deleteProductAction(id);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Produkt został dezaktywowany.' });
        const productsRes = await getProductsAction();
        if (productsRes.success) setProducts(productsRes.data || []);
        const dashRes = await getWarehouseDashboardAction();
        if (dashRes.success) setDashboard(dashRes.data || {});
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd dezaktywacji.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // Obsługa importu z arkusza Excel / CSV
  const handleFileImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (rows.length < 2) {
          setImportStatus({ type: 'error', text: 'Arkusz jest pusty lub nie posiada nagłówków.' });
          return;
        }

        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        
        // Pomocnik dopasowania indeksu kolumn
        const colIndex = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));

        const idxName = colIndex(['nazwa', 'name', 'artykuł', 'produkt']);
        const idxCategory = colIndex(['kategoria', 'category', 'grupa']);
        const idxUnit = colIndex(['jednostka', 'unit', 'miara']);
        const idxSupplier = colIndex(['dostawca', 'supplier', 'producent']);
        const idxSku = colIndex(['sku', 'kod', 'index']);
        const idxLocation = colIndex(['lokalizacja', 'location', 'półka', 'miejsce']);
        const idxInitialStock = colIndex(['stan', 'ilość', 'stock', 'ilośc', 'początkowy', 'ilosc']);
        const idxMinStock = colIndex(['min', 'minimalny', 'ostrzegawczy']);
        const idxMaxStock = colIndex(['max', 'maksymalny']);
        const idxHasExpiry = colIndex(['ważności', 'expiry', 'data', 'waznosci']);
        const idxAutoSpotCheck = colIndex(['wybiórcza', 'spot', 'auto', 'wybiorcza']);
        const idxRemarks = colIndex(['uwagi', 'remarks', 'opis']);

        if (idxName === -1 || idxCategory === -1) {
          setImportStatus({ type: 'error', text: 'Nie odnaleziono wymaganych kolumn (Nazwa, Kategoria).' });
          return;
        }

        const parsedProducts: any[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0 || !row[idxName]) continue;

          const parseBoolean = (val: any) => {
            if (!val) return false;
            const str = String(val).trim().toLowerCase();
            return str === 'tak' || str === 'yes' || str === 'true' || str === '1' || str === 't';
          };

          parsedProducts.push({
            name: String(row[idxName]).trim(),
            categoryName: String(row[idxCategory]).trim(),
            unit: idxUnit !== -1 && row[idxUnit] ? String(row[idxUnit]).trim() : 'szt.',
            supplier: idxSupplier !== -1 && row[idxSupplier] ? String(row[idxSupplier]).trim() : '',
            sku: idxSku !== -1 && row[idxSku] ? String(row[idxSku]).trim() : '',
            location: idxLocation !== -1 && row[idxLocation] ? String(row[idxLocation]).trim() : '',
            initialStock: idxInitialStock !== -1 && row[idxInitialStock] ? Number(row[idxInitialStock]) || 0 : 0,
            minStock: idxMinStock !== -1 && row[idxMinStock] ? Number(row[idxMinStock]) || 0 : 0,
            maxStock: idxMaxStock !== -1 && row[idxMaxStock] ? Number(row[idxMaxStock]) || 0 : 0,
            hasExpiry: idxHasExpiry !== -1 ? parseBoolean(row[idxHasExpiry]) : false,
            autoSpotCheck: idxAutoSpotCheck !== -1 ? parseBoolean(row[idxAutoSpotCheck]) : false,
            remarks: idxRemarks !== -1 && row[idxRemarks] ? String(row[idxRemarks]).trim() : ''
          });
        }

        if (parsedProducts.length === 0) {
          setImportStatus({ type: 'error', text: 'Brak poprawnych rekordów produktów w pliku.' });
        } else {
          setImportPreview(parsedProducts);
        }
      } catch (err: any) {
        setImportStatus({ type: 'error', text: 'Błąd przetwarzania pliku Excel: ' + err.message });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;
    setActionLoading(true);
    setImportStatus(null);
    try {
      const res = await importBulkProductsAction(importPreview);
      if (res.success) {
        setImportStatus({ type: 'success', text: `Pomyślnie zaimportowano ${res.count} produktów.` });
        setImportPreview([]);
        loadData();
      } else {
        setImportStatus({ type: 'error', text: res.error || 'Błąd zapisu danych w bazie.' });
      }
    } catch (err: any) {
      setImportStatus({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  // Czyszczenie historii operacji
  const handleClearHistory = async () => {
    const confirm1 = window.confirm("⚠️ OSTRZEŻENIE!\n\nCzy na pewno chcesz usunąć całą historię operacji magazynowych dla tego lokalu? Ta operacja jest całkowicie nieodwracalna!");
    if (!confirm1) return;
    
    const confirm2 = window.confirm("⚠️ POTWIERDZENIE OSTATECZNE\n\nPotwierdź ponownie, aby bezpowrotnie wyczyścić rejestr ruchów magazynowych. Stany magazynowe (ilości w partiach) pozostaną bez zmian.");
    if (!confirm2) return;

    setActionLoading(true);
    try {
      const res = await clearWarehouseHistoryAction();
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Pomyślnie wyczyszczono całą historię operacji.' });
        const historyRes = await getWarehouseHistoryAction();
        if (historyRes.success) setHistory(historyRes.data || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd czyszczenia historii.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // -------------------------------------------------------------
  // OPERACJE DOSTAW
  // -------------------------------------------------------------
  // Pomocnicze: resetuj koszyk dostawy
  const resetBulkDelivery = () => {
    setBulkDelivery({ supplier: '', documentNumber: '', remarks: '' });
    setBulkItems([{ uid: crypto.randomUUID(), productId: '', quantity: 1, batchNumber: '', expiryDate: '' }]);
    setDeliverFile(null);
    setDeliverFileWarning(false);
  };

  // Dodaj pustą pozycję do koszyka
  const addBulkItem = () => {
    setBulkItems(prev => [...prev, { uid: crypto.randomUUID(), productId: '', quantity: 1, batchNumber: '', expiryDate: '' }]);
  };

  // Usuń pozycję z koszyka (minimum 1 musi zostać)
  const removeBulkItem = (uid: string) => {
    setBulkItems(prev => prev.length > 1 ? prev.filter(i => i.uid !== uid) : prev);
  };

  // Zaktualizuj pole pozycji w koszyku
  const updateBulkItem = (uid: string, field: keyof BulkItem, value: any) => {
    setBulkItems(prev => prev.map(i => i.uid === uid ? { ...i, [field]: value } : i));
  };

  // Szybkie dodanie nowego produktu w trakcie dostawy
  const handleQuickAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name.trim() || !quickAddForm.categoryId) return;
    setActionLoading(true);
    try {
      const res = await addProductAction({
        name: quickAddForm.name,
        categoryId: quickAddForm.categoryId,
        unit: quickAddForm.unit,
        supplier: quickAddForm.supplier,
        hasExpiry: quickAddForm.hasExpiry,
        minStock: quickAddForm.minStock,
        maxStock: quickAddForm.maxStock,
        sku: '',
        location: quickAddForm.location,
        autoSpotCheck: false,
        remarks: ''
      });
      if (res.success && res.productId) {
        const productsRes = await getProductsAction();
        if (productsRes.success) setProducts(productsRes.data || []);
        // Ustaw nowy produkt w docelowej pozycji koszyka
        if (quickAddTargetUid) {
          updateBulkItem(quickAddTargetUid, 'productId', res.productId);
        }
        setQuickAddProduct(false);
        setQuickAddForm({ name: '', categoryId: '', unit: 'szt.', supplier: '', hasExpiry: false, minStock: 0, maxStock: 0, location: '' });
        setQuickSupplierCustom(false);
        setQuickLocationCustom(false);
        setQuickAddTargetUid(null);
        setStatusMsg({ type: 'success', text: `Dodano nowy produkt "${quickAddForm.name}" do katalogu.` });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd dodawania produktu.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // Zbiorcze przyjęcie dostawy
  const handleBulkDelivery = async (e: React.FormEvent) => {
    e.preventDefault();

    // Walidacja: każda pozycja musi mieć produkt
    const validItems = bulkItems.filter(i => i.productId !== '' && i.quantity > 0);
    if (validItems.length === 0) {
      setStatusMsg({ type: 'error', text: 'Dodaj co najmniej jedną pozycję dostawy.' });
      setTimeout(() => setStatusMsg(null), 4000);
      return;
    }

    // Miękkie ostrzeżenie przy braku zdjęcia
    if (!deliverFile) {
      setDeliverFileWarning(true);
      const proceed = window.confirm(
        '\u26a0\ufe0f Brak zdjęcia faktury / paragonu!\n\nZdjęcie dokumentu jest wymagane do pełnej zgodności z procedurami.\n\nCzy na pewno chcesz przejść dalej bez zdjęcia?'
      );
      if (!proceed) return;
    } else {
      const confirmed = window.confirm(`Czy na pewno chcesz zarejestrować dostawę (${validItems.length} poz.)? Po zatwierdzeniu stany magazynowe zostaną zaktualizowane.`);
      if (!confirmed) return;
    }

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('supplier', bulkDelivery.supplier || 'Dostawca Zewnętrzny');
      formData.append('documentNumber', bulkDelivery.documentNumber || '');
      formData.append('remarks', bulkDelivery.remarks || '');
      formData.append('items', JSON.stringify(validItems.map(i => ({
        productId: i.productId,
        quantity: i.quantity,
        batchNumber: i.batchNumber || '',
        expiryDate: i.expiryDate || ''
      }))));
      if (deliverFile) {
        formData.append('file', deliverFile);
      } else {
        formData.append('file', new Blob([], { type: 'image/jpeg' }), 'brak-zdj.jpg');
      }

      const res = await deliverBulkProductsAction(formData);

      if (res.success) {
        setStatusMsg({ type: 'success', text: `Zarejestrowano dostawę: ${validItems.length} pozycji. Stany zostały zaktualizowane.` });
        resetBulkDelivery();
        const [productsRes, dashRes, historyRes] = await Promise.all([
          getProductsAction(),
          getWarehouseDashboardAction(),
          getWarehouseHistoryAction()
        ]);
        if (productsRes.success) setProducts(productsRes.data || []);
        if (dashRes.success) setDashboard(dashRes.data || {});
        if (historyRes.success) setHistory(historyRes.data || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd przyjęcia dostawy.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 5000);
    }
  };

  // -------------------------------------------------------------
  // OPERACJE WYDAŃ
  // -------------------------------------------------------------
  const openIssueModal = (p: any) => {
    setShowIssueModal(p.id);
    setIssueForm({
      quantity: 1,
      venue: 'Kraków Rynek',
      remarks: ''
    });
  };

  const handleIssueProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showIssueModal) return;
    setActionLoading(true);
    try {
      const res = await issueProductAction({
        productId: showIssueModal,
        ...issueForm
      });

      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Zatwierdzono wydanie produktu na lokal.' });
        setShowIssueModal(null);
        const [productsRes, dashRes, historyRes] = await Promise.all([
          getProductsAction(),
          getWarehouseDashboardAction(),
          getWarehouseHistoryAction()
        ]);
        if (productsRes.success) setProducts(productsRes.data || []);
        if (dashRes.success) setDashboard(dashRes.data || {});
        if (historyRes.success) setHistory(historyRes.data || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd wydania produktu.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  // -------------------------------------------------------------
  // INWENTARYZACJE (SESJE)
  // -------------------------------------------------------------
  const handleStartFullInventory = async (catId: number | null) => {
    setActionLoading(true);
    try {
      const res = await startInventoryAction(catId);
      if (res.success && res.inventoryId) {
        setStatusMsg({ type: 'success', text: 'Rozpoczęto nową sesję inwentaryzacyjną.' });
        // Wczytaj szczegóły nowo utworzonej inwentaryzacji
        setActiveInventoryId(res.inventoryId);
        const details = await getInventoryDetailsAction(res.inventoryId);
        if (details.success) {
          setActiveInventory(details);
          // Inicjalizuj formularz
          const initValues: any = {};
          details.items?.forEach((item: any) => {
            initValues[item.productId] = {
              actualStock: item.actualStock !== null ? item.actualStock : item.systemStock,
              remarks: item.remarks || ''
            };
          });
          setInventoryFormValues(initValues);
        }
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd inicjalizacji inwentaryzacji.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const handleResumeInventory = async (id: number) => {
    setActiveInventoryId(id);
    setActionLoading(true);
    try {
      const details = await getInventoryDetailsAction(id);
      if (details.success) {
        setActiveInventory(details);
        const initValues: any = {};
        details.items?.forEach((item: any) => {
          initValues[item.productId] = {
            actualStock: item.actualStock !== null ? item.actualStock : item.systemStock,
            remarks: item.remarks || ''
          };
        });
        setInventoryFormValues(initValues);
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveInventoryDraft = async () => {
    if (!activeInventoryId) return;
    setActionLoading(true);
    try {
      const itemsPayload = Object.keys(inventoryFormValues).map(pId => ({
        productId: Number(pId),
        actualStock: inventoryFormValues[Number(pId)].actualStock,
        remarks: inventoryFormValues[Number(pId)].remarks
      }));

      const res = await saveInventoryDraftAction(activeInventoryId, itemsPayload);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Zapisano wersję roboczą inwentaryzacji.' });
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd zapisu.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleSubmitInventory = async () => {
    if (!activeInventoryId) return;
    if (!confirm("Czy na pewno chcesz zatwierdzić tę inwentaryzację? System automatycznie wyliczy różnice i wprowadzi odpowiednie korekty w partiach produktów oraz historii.")) return;
    
    setActionLoading(true);
    try {
      const itemsPayload = Object.keys(inventoryFormValues).map(pId => ({
        productId: Number(pId),
        actualStock: inventoryFormValues[Number(pId)].actualStock,
        remarks: inventoryFormValues[Number(pId)].remarks
      }));

      const res = await submitInventoryAction(activeInventoryId, itemsPayload);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Inwentaryzacja zatwierdzona pomyślnie. Stany zostały skorygowane.' });
        setActiveInventoryId(null);
        setActiveInventory(null);
        
        // Odśwież dane
        const [productsRes, dashRes, historyRes, inventoriesRes] = await Promise.all([
          getProductsAction(),
          getWarehouseDashboardAction(),
          getWarehouseHistoryAction(),
          getInventoryHistoryAction()
        ]);
        if (productsRes.success) setProducts(productsRes.data || []);
        if (dashRes.success) setDashboard(dashRes.data || {});
        if (historyRes.success) setHistory(historyRes.data || []);
        if (inventoriesRes.success) setInventories(inventoriesRes.data || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd zatwierdzania inwentaryzacji.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const handleCancelInventory = async () => {
    if (!activeInventoryId) return;
    if (!confirm("Czy chcesz bezpowrotnie usunąć tę sesję inwentaryzacji roboczej? Dotychczas wpisane stany rzeczywiste zostaną utracone.")) return;
    
    setActionLoading(true);
    try {
      const res = await cancelInventoryAction(activeInventoryId);
      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Sesja inwentaryzacji została anulowana.' });
        setActiveInventoryId(null);
        setActiveInventory(null);
        const inventoriesRes = await getInventoryHistoryAction();
        if (inventoriesRes.success) setInventories(inventoriesRes.data || []);
      } else {
        setStatusMsg({ type: 'error', text: res.error || 'Błąd anulowania.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  const handleViewInventoryDetails = async (id: number) => {
    setLoading(true);
    try {
      const res = await getInventoryDetailsAction(id);
      if (res.success) {
        setViewingInventoryDetails(res);
      }
    } catch (e: any) {
      setStatusMsg({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // FILTROWANIE PRODUKTÓW
  // -------------------------------------------------------------
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryFilter === '' || p.categoryId === Number(selectedCategoryFilter);
    const matchesStatus = selectedStatusFilter === 'all' || p.status === selectedStatusFilter;
    
    let matchesAlert = true;
    if (selectedAlertFilter === 'low') {
      matchesAlert = p.currentStock <= p.minStock;
    } else if (selectedAlertFilter === 'expiry') {
      matchesAlert = p.hasExpiry && dashboard.expiryAlertsList?.some((alert: any) => alert.productName === p.name);
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesAlert;
  });

  // Filtrowanie historii
  const filteredHistory = history.filter(h => {
    const matchesProduct = histProductFilter === '' || h.productName.toLowerCase().includes(histProductFilter.toLowerCase());
    const matchesType = histTypeFilter === '' || h.type === histTypeFilter;
    return matchesProduct && matchesType;
  });

  if (status === 'loading' || (loading && products.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand-gold"></div>
        <p className="text-xs text-[#a0a0a0] uppercase tracking-wider font-semibold animate-pulse">Ładowanie modułu Magazyn...</p>
      </div>
    );
  }

  // Pomocnicze zmienne ról/uprawnień
  const canManage = hasPermission(session?.user, 'inventory:manage');
  const canDeliver = hasPermission(session?.user, 'inventory:deliver');
  const canIssue = hasPermission(session?.user, 'inventory:issue');
  const canInventory = hasPermission(session?.user, 'inventory:inventory');

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 animate-fadeIn">
      {/* Nagłówek i Akcje */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-brand-gold/10 rounded-xl flex items-center justify-center border border-brand-gold/20">
              <Package className="w-5 h-5 text-brand-gold" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight uppercase font-display">
                Gospodarka <span className="text-brand-gold">Magazynowa</span>
              </h2>
              <p className="text-[10px] text-[#888] uppercase tracking-wider font-semibold">
                System Czasu Rzeczywistego i Zautomatyzowanych Stanów
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2.5 bg-[#141414] hover:bg-[#1e1e1e] text-[#a0a0a0] hover:text-white rounded-lg border border-white/5 transition flex items-center gap-2 cursor-pointer text-xs font-semibold uppercase tracking-wider"
            title="Odśwież stany"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Odśwież</span>
          </button>
          
          {canManage && (
            <>
              <button
                onClick={() => {
                  setImportPreview([]);
                  setImportStatus(null);
                  setShowImportModal(true);
                }}
                className="px-4 py-2.5 bg-[#141414] hover:bg-[#1e1e1e] text-brand-gold text-xs font-black rounded-lg border border-brand-gold/20 uppercase tracking-wider transition hover:-translate-y-0.5 cursor-pointer flex items-center gap-2"
              >
                <span>📥 Importuj z Excela</span>
              </button>

              <button
                onClick={openProductAdd}
                className="px-4 py-2.5 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-2 shadow-lg shadow-brand-red/10"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Dodaj produkt</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Komunikat o statusie */}
      {statusMsg && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-bold animate-fadeIn ${
          statusMsg.type === 'success' 
            ? 'bg-green-500/10 border-green-500/20 text-green-400' 
            : 'bg-brand-red/10 border-brand-red/20 text-brand-red'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Aktywna inwentaryzacja robocza (Ostrzeżenie u góry) */}
      {activeInventoryId && activeInventory && activeTab !== 'inventories' && (
        <div className="p-4 bg-brand-gold/10 border border-brand-gold/20 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-pulse">
          <div className="flex gap-3 items-center">
            <AlertTriangle className="w-5 h-5 text-brand-gold shrink-0" />
            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider">
                Trwa otwarta sesja inwentaryzacji roboczej ({activeInventory.header?.type === 'spot' ? 'Wybiórcza' : 'Pełna'})!
              </p>
              <p className="text-[10px] text-[#aaa]">
                Wpisane stany nie zostały jeszcze zatwierdzone. Przejdź do zakładki inwentaryzacji, aby zapisać lub zatwierdzić korekty.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setActiveTab('inventories'); handleResumeInventory(activeInventoryId); }}
            className="px-4 py-2 bg-brand-gold text-brand-dark text-xs font-extrabold rounded-lg uppercase tracking-wider hover:opacity-90 transition cursor-pointer"
          >
            Wróć do inwentaryzacji
          </button>
        </div>
      )}

      {/* Nawigacja po zakładakach */}
      <div className="flex border-b border-white/5 overflow-x-auto gap-2 scrollbar-thin">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
          { id: 'products', label: 'Katalog produktów', icon: Package },
          ...(canDeliver ? [{ id: 'deliveries', label: 'Dostawy / Przyjęcia', icon: ArrowUpRight }] : []),
          ...(canIssue ? [{ id: 'issues', label: 'Wydania na lokale', icon: ArrowDownRight }] : []),
          ...(canInventory ? [{ id: 'inventories', label: 'Inwentaryzacje', icon: ClipboardCheck }] : []),
          ...(canManage ? [{ id: 'categories', label: 'Kategorie', icon: Layers }] : []),
          { id: 'history', label: 'Historia operacji', icon: Clock }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setStatusMsg(null); }}
              className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition border-b-2 flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-brand-gold text-white bg-white/5 rounded-t-xl'
                  : 'border-transparent text-[#888] hover:text-white hover:bg-white/2'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* KARTA: DASHBOARD                                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Siatka Statystyk */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-2">
              <span className="text-[10px] font-bold text-[#888] uppercase tracking-wider block">Wszystkie Artykuły</span>
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-black text-white">{dashboard.totalProductsCount || 0}</span>
                <span className="text-xs text-brand-gold font-bold">Aktywne</span>
              </div>
            </div>

            <button 
              onClick={() => { setActiveTab('products'); setSelectedAlertFilter('low'); }}
              className={`glass-card p-6 rounded-2xl border transition-all text-left space-y-2 cursor-pointer ${
                dashboard.lowStockCount > 0 
                  ? 'border-brand-red/30 bg-brand-red/5 hover:bg-brand-red/10' 
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              <span className="text-[10px] font-bold text-[#888] uppercase tracking-wider block">Niskie stany</span>
              <div className="flex justify-between items-baseline">
                <span className={`text-3xl font-black ${dashboard.lowStockCount > 0 ? 'text-brand-red' : 'text-white'}`}>
                  {dashboard.lowStockCount || 0}
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  dashboard.lowStockCount > 0 ? 'bg-brand-red/20 text-brand-red' : 'bg-green-500/10 text-green-400'
                }`}>
                  {dashboard.lowStockCount > 0 ? 'Zamówić' : 'Stabilnie'}
                </span>
              </div>
            </button>

            <button 
              onClick={() => { setActiveTab('products'); setSelectedAlertFilter('expiry'); }}
              className={`glass-card p-6 rounded-2xl border transition-all text-left space-y-2 cursor-pointer ${
                dashboard.expiryAlertsCount > 0 
                  ? 'border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10' 
                  : 'border-white/5 hover:border-white/10'
              }`}
            >
              <span className="text-[10px] font-bold text-[#888] uppercase tracking-wider block">Terminy ważności</span>
              <div className="flex justify-between items-baseline">
                <span className={`text-3xl font-black ${dashboard.expiryAlertsCount > 0 ? 'text-orange-400' : 'text-white'}`}>
                  {dashboard.expiryAlertsCount || 0}
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                  dashboard.expiryAlertsCount > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/10 text-green-400'
                }`}>
                  {dashboard.expiryAlertsCount > 0 ? 'Alert' : 'OK'}
                </span>
              </div>
            </button>

            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-2">
              <span className="text-[10px] font-bold text-[#888] uppercase tracking-wider block">Ostatnia inwentaryzacja</span>
              {dashboard.lastInventory ? (
                <div>
                  <span className="text-sm font-extrabold text-white block">
                    {new Date(dashboard.lastInventory.date).toLocaleDateString('pl-PL')}
                  </span>
                  <span className="text-[9px] text-[#555] block">Wykonawca: {dashboard.lastInventory.userName}</span>
                </div>
              ) : (
                <span className="text-xs text-[#555] italic block pt-1">Brak danych</span>
              )}
            </div>
          </div>

          {/* Oczekujący Spot Check dnia dzisiejszego */}
          {dashboard.activeSpotCheckId && (
            <div className="p-5 bg-gradient-to-r from-brand-red/10 to-brand-gold/10 border border-brand-gold/20 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex gap-3.5 items-start">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Automatyczna inwentaryzacja wybiórcza (Spot Check) jest aktywna!</h4>
                  <p className="text-[11px] text-[#aaa] mt-0.5">
                    Wylosowano 3 pozycje do szybkiego przeliczenia i zatwierdzenia przez pracownika na dzisiejszej zmianie.
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setActiveTab('inventories'); handleResumeInventory(dashboard.activeSpotCheckId); }}
                className="px-4 py-2.5 bg-brand-gold hover:opacity-90 text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider transition cursor-pointer shrink-0"
              >
                Przejdź do weryfikacji
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Ostatnie Dostawy */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-green-400" />
                <span>Ostatnie dostawy / Przyjęcia</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                      <th className="pb-3">Data</th>
                      <th className="pb-3">Produkt</th>
                      <th className="pb-3 text-right">Ilość</th>
                      <th className="pb-3">Dostawca</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                    {dashboard.recentDeliveries?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center italic text-[#555]">Brak ostatnich przyjęć.</td>
                      </tr>
                    ) : (
                      dashboard.recentDeliveries?.map((d: any) => (
                        <tr key={d.id} className="hover:bg-white/2 transition">
                          <td className="py-3 text-[11px] font-mono">
                            {new Date(d.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                          </td>
                          <td className="py-3 font-semibold text-white">{d.productName}</td>
                          <td className="py-3 text-right font-black text-green-400">+{d.quantity}</td>
                          <td className="py-3 text-[11px] truncate max-w-[120px]">{d.source}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ostatnie Wydania */}
            <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-brand-red" />
                <span>Ostatnie wydania na lokale</span>
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                      <th className="pb-3">Data</th>
                      <th className="pb-3">Produkt</th>
                      <th className="pb-3 text-right">Ilość</th>
                      <th className="pb-3">Lokal docelowy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                    {dashboard.recentIssues?.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center italic text-[#555]">Brak ostatnich wydań.</td>
                      </tr>
                    ) : (
                      dashboard.recentIssues?.map((i: any) => (
                        <tr key={i.id} className="hover:bg-white/2 transition">
                          <td className="py-3 text-[11px] font-mono">
                            {new Date(i.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' })}
                          </td>
                          <td className="py-3 font-semibold text-white">{i.productName}</td>
                          <td className="py-3 text-right font-black text-brand-red">{i.quantity}</td>
                          <td className="py-3 text-[11px] font-bold text-[#e0e0e0]">{i.source}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* KARTA: KATALOG PRODUKTÓW                                      */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Pasek filtrowania */}
          <div className="glass-card p-4 rounded-2xl border border-white/5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#555]" />
              <input
                type="text"
                placeholder="Szukaj po nazwie, SKU, dostawcy..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder-[#555] focus:outline-none focus:border-brand-gold transition"
              />
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={e => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold transition"
            >
              <option value="">Wszystkie Kategorie</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              value={selectedAlertFilter}
              onChange={e => setSelectedAlertFilter(e.target.value as any)}
              className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold transition"
            >
              <option value="all">Wszystkie stany</option>
              <option value="low">Tylko niskie stany (Zamówić)</option>
              <option value="expiry">Tylko alerty terminów ważności</option>
            </select>

            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold transition"
            >
              <option value="active">Tylko aktywne</option>
              <option value="inactive">Tylko nieaktywne</option>
              <option value="all">Status: Wszystkie</option>
            </select>
          </div>

          {/* Tabela produktów */}
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01] text-[10px] font-extrabold text-[#555] uppercase tracking-wider">
                    <th className="p-4">Nazwa artykułu</th>
                    <th className="p-4">Kategoria</th>
                    <th className="p-4 text-right">Stan aktualny</th>
                    <th className="p-4 text-right">Stan minimalny</th>
                    <th className="p-4">SKU / Lokalizacja</th>
                    <th className="p-4 text-center">Wydarzenia / Alerty</th>
                    <th className="p-4 text-right">Operacje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center italic text-[#555]">Brak produktów spełniających kryteria wyszukiwania.</td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLow = p.currentStock <= p.minStock;
                      const hasExpiryAlert = p.hasExpiry && dashboard.expiryAlertsList?.some((alert: any) => alert.productName === p.name);
                      
                      return (
                        <tr key={p.id} className="hover:bg-white/[0.01] transition">
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-white block">{p.name}</span>
                              <span className="text-[10px] text-[#555] block">Dostawca: {p.supplier || 'Brak'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[9px] font-extrabold uppercase text-[#ccc]">
                              {p.categoryName || 'Brak'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <span className={`font-black text-sm ${isLow ? 'text-brand-red' : 'text-white'}`}>
                              {p.currentStock} {p.unit}
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono text-[#555]">
                            {p.minStock} {p.unit}
                          </td>
                          <td className="p-4">
                            <div className="space-y-0.5 font-mono text-[10px]">
                              {p.sku && <span className="block text-[#888]">SKU: {p.sku}</span>}
                              {p.location && <span className="block text-[#555]">Sektor: {p.location}</span>}
                              {!p.sku && !p.location && <span className="text-[#333] italic">brak danych</span>}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-1.5">
                              {isLow && (
                                <span className="px-2 py-0.5 bg-brand-red/10 border border-brand-red/20 text-brand-red text-[8px] font-black uppercase rounded" title="Stan minimalny przekroczony!">
                                  Niski Stan
                                </span>
                              )}
                              {hasExpiryAlert && (
                                <span className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[8px] font-black uppercase rounded" title="Wykryto partie bliskie końca ważności!">
                                  Ważność
                                </span>
                              )}
                              {p.autoSpotCheck && (
                                <span className="px-2 py-0.5 bg-brand-gold/10 border border-brand-gold/20 text-brand-gold text-[8px] font-black uppercase rounded" title="Produkt podlega automatycznej wybiórczej inwentaryzacji">
                                  Spot
                                </span>
                              )}
                              {!isLow && !hasExpiryAlert && !p.autoSpotCheck && (
                                <span className="text-[#333] font-mono text-[9px] italic">OK</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {canDeliver && p.status === 'active' && (
                                <button
                                  onClick={() => {
                                    setBulkItems([{ uid: crypto.randomUUID(), productId: p.id, quantity: 1, batchNumber: '', expiryDate: '' }]);
                                    setBulkDelivery(prev => ({ ...prev, supplier: p.supplier || '' }));
                                    setActiveTab('deliveries');
                                  }}
                                  className="px-2 py-1 bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/30 text-green-400 text-[10px] font-bold uppercase rounded cursor-pointer transition"
                                >
                                  Dostawa
                                </button>
                              )}
                              {canIssue && p.status === 'active' && p.currentStock > 0 && (
                                <button
                                  onClick={() => openIssueModal(p)}
                                  className="px-2 py-1 bg-brand-red/10 border border-brand-red/20 hover:bg-brand-red/20 hover:border-brand-red/30 text-brand-red text-[10px] font-bold uppercase rounded cursor-pointer transition"
                                >
                                  Wydaj
                                </button>
                              )}
                              {canManage && (
                                <div className="flex gap-1 border-l border-white/5 pl-2 ml-1">
                                  <button
                                    onClick={() => openProductEdit(p)}
                                    className="p-1 text-[#888] hover:text-white transition cursor-pointer"
                                    title="Edytuj produkt"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  {p.status === 'active' && (
                                    <button
                                      onClick={() => handleDeleteProduct(p.id)}
                                      className="p-1 text-[#555] hover:text-brand-red transition cursor-pointer"
                                      title="Dezaktywuj produkt"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* KARTA: DOSTAWY                                                */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'deliveries' && (
        <div className="space-y-6">
          {/* Modal szybkiego dodania produktu */}
          {quickAddProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="glass-card p-6 rounded-2xl border border-white/10 w-full max-w-md space-y-4 relative">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-gold to-yellow-400 rounded-t-2xl" />
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Plus className="w-4 h-4 text-brand-gold" />
                    Szybkie dodanie nowego produktu
                  </h3>
                  <button onClick={() => setQuickAddProduct(false)} className="text-[#555] hover:text-white transition cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={handleQuickAddProduct} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">Nazwa produktu *</label>
                    <input
                      type="text" required autoFocus
                      value={quickAddForm.name}
                      onChange={e => setQuickAddForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="np. Dętka 14&quot; MTB"
                      className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">Kategoria *</label>
                      <select required
                        value={quickAddForm.categoryId}
                        onChange={e => setQuickAddForm(p => ({ ...p, categoryId: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                      >
                        <option value="">-- Wybierz --</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">Jednostka</label>
                      <select
                        value={quickAddForm.unit}
                        onChange={e => setQuickAddForm(p => ({ ...p, unit: e.target.value }))}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                      >
                        {['szt.','kg','l','m','op.','para','kpl.'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">Dostawca</label>
                    {!quickSupplierCustom ? (
                      <select
                        value={presetSuppliers.includes(quickAddForm.supplier) ? quickAddForm.supplier : quickAddForm.supplier ? '__custom__' : ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setQuickSupplierCustom(true);
                            setQuickAddForm(p => ({ ...p, supplier: '' }));
                          } else {
                            setQuickAddForm(p => ({ ...p, supplier: val }));
                          }
                        }}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                      >
                        <option value="">-- Wybierz dostawcę --</option>
                        {presetSuppliers.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="__custom__" className="text-brand-gold font-bold">✍️ Wpisz innego...</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Wpisz dostawcę..."
                          value={quickAddForm.supplier}
                          onChange={e => setQuickAddForm(p => ({ ...p, supplier: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-[#141414] border border-brand-gold/30 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                        />
                        <button
                          type="button"
                          onClick={() => { setQuickSupplierCustom(false); setQuickAddForm(p => ({ ...p, supplier: presetSuppliers[0] || '' })); }}
                          className="px-2 py-1 text-[10px] text-brand-gold border border-brand-gold/10 hover:bg-brand-gold/10 rounded transition cursor-pointer"
                        >
                          Lista
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1">Miejsce składowania (Lokalizacja)</label>
                    {!quickLocationCustom ? (
                      <select
                        value={presetLocations.includes(quickAddForm.location) ? quickAddForm.location : quickAddForm.location ? '__custom__' : ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setQuickLocationCustom(true);
                            setQuickAddForm(p => ({ ...p, location: '' }));
                          } else {
                            setQuickAddForm(p => ({ ...p, location: val }));
                          }
                        }}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                      >
                        <option value="">-- Wybierz lokalizację --</option>
                        {presetLocations.map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                        <option value="__custom__" className="text-brand-gold font-bold">✍️ Wpisz inną...</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="np. Regał A-3..."
                          value={quickAddForm.location}
                          onChange={e => setQuickAddForm(p => ({ ...p, location: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-[#141414] border border-brand-gold/30 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                        />
                        <button
                          type="button"
                          onClick={() => { setQuickLocationCustom(false); setQuickAddForm(p => ({ ...p, location: presetLocations[0] || '' })); }}
                          className="px-2 py-1 text-[10px] text-brand-gold border border-brand-gold/10 hover:bg-brand-gold/10 rounded transition cursor-pointer"
                        >
                          Lista
                        </button>
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={quickAddForm.hasExpiry} onChange={e => setQuickAddForm(p => ({ ...p, hasExpiry: e.target.checked }))} className="rounded" />
                    <span className="text-xs text-[#a0a0a0] group-hover:text-white transition">Produkt ma datę ważności</span>
                  </label>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setQuickAddProduct(false)} className="flex-1 py-2 text-xs font-bold text-[#888] hover:text-white border border-white/10 rounded-lg transition cursor-pointer">Anuluj</button>
                    <button type="submit" disabled={actionLoading} className="flex-1 py-2 text-xs font-black text-brand-dark bg-brand-gold hover:opacity-90 rounded-lg transition cursor-pointer uppercase tracking-wider">
                      {actionLoading ? '...' : 'Dodaj produkt'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Formularz zbiorczej dostawy */}
          {canDeliver ? (
            <form onSubmit={handleBulkDelivery} className="space-y-5">
              {/* Nagłówek dostawy */}
              <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-brand-gold" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-400" />
                  Nowa dostawa zbiorcza
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Dostawca</label>
                    {!bulkSupplierCustom ? (
                      <select
                        value={presetSuppliers.includes(bulkDelivery.supplier) ? bulkDelivery.supplier : bulkDelivery.supplier ? '__custom__' : ''}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setBulkSupplierCustom(true);
                            setBulkDelivery(p => ({ ...p, supplier: '' }));
                          } else {
                            setBulkDelivery(p => ({ ...p, supplier: val }));
                          }
                        }}
                        className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                      >
                        <option value="">-- Wybierz dostawcę --</option>
                        {presetSuppliers.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="__custom__" className="text-brand-gold font-bold">✍️ Wpisz innego...</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Wpisz nazwę dostawcy..."
                          value={bulkDelivery.supplier}
                          onChange={e => setBulkDelivery(p => ({ ...p, supplier: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-[#141414] border border-brand-gold/30 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                        />
                        <button
                          type="button"
                          onClick={() => { setBulkSupplierCustom(false); setBulkDelivery(p => ({ ...p, supplier: presetSuppliers[0] || '' })); }}
                          className="px-2 py-1 text-[10px] text-brand-gold border border-brand-gold/10 hover:bg-brand-gold/10 rounded transition cursor-pointer"
                        >
                          Lista
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Numer faktury / dokumentu</label>
                    <input
                      type="text"
                      placeholder="np. FV/2026/08/948"
                      value={bulkDelivery.documentNumber}
                      onChange={e => setBulkDelivery(p => ({ ...p, documentNumber: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Uwagi do całej dostawy</label>
                    <input
                      type="text"
                      placeholder="Opcjonalne..."
                      value={bulkDelivery.remarks}
                      onChange={e => setBulkDelivery(p => ({ ...p, remarks: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    />
                  </div>
                </div>
              </div>

              {/* Koszyk pozycji dostawy */}
              <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-gold to-yellow-400" />
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Pozycje dostawy
                    <span className="ml-2 px-2 py-0.5 bg-brand-gold/20 text-brand-gold rounded-full text-[10px]">{bulkItems.filter(i => i.productId !== '').length} / {bulkItems.length}</span>
                  </h3>
                  <button
                    type="button"
                    onClick={addBulkItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-brand-gold border border-brand-gold/30 hover:bg-brand-gold/10 rounded-lg transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Dodaj pozycję
                  </button>
                </div>

                {/* Nagłówki kolumn */}
                <div className="hidden sm:grid grid-cols-12 gap-2 text-[9px] font-extrabold text-[#555] uppercase tracking-wider pb-1 border-b border-white/5">
                  <div className="col-span-5">Produkt</div>
                  <div className="col-span-2 text-center">Ilość</div>
                  <div className="col-span-2">Nr partii</div>
                  <div className="col-span-2">Data ważności</div>
                  <div className="col-span-1"></div>
                </div>

                {/* Wiersze pozycji */}
                <div className="space-y-2">
                  {bulkItems.map((item, idx) => {
                    const selectedProd = products.find(p => p.id === item.productId);
                    return (
                      <div key={item.uid} className="grid grid-cols-12 gap-2 items-start p-2 rounded-xl bg-white/2 hover:bg-white/[0.03] transition border border-white/5">
                        {/* Produkt */}
                        <div className="col-span-12 sm:col-span-5 relative">
                          <div className="flex gap-1.5">
                            {/* Custom Searchable Select (Combobox) */}
                            <div className="relative flex-1">
                              <div
                                onClick={() => setDropdownOpen(prev => ({ ...prev, [item.uid]: !prev[item.uid] }))}
                                className="w-full px-3 py-2 bg-[#141414] border border-white/10 hover:border-white/20 rounded-lg text-white text-xs focus-within:border-brand-gold transition cursor-pointer flex justify-between items-center"
                              >
                                <input
                                  type="text"
                                  placeholder="Wyszukaj produkt..."
                                  value={
                                    dropdownOpen[item.uid]
                                      ? (dropdownSearch[item.uid] ?? '')
                                      : (selectedProd ? `${selectedProd.name} (${selectedProd.unit})` : '')
                                  }
                                  onChange={e => {
                                    setDropdownSearch(prev => ({ ...prev, [item.uid]: e.target.value }));
                                    setDropdownOpen(prev => ({ ...prev, [item.uid]: true }));
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  onFocus={() => {
                                    setDropdownOpen(prev => ({ ...prev, [item.uid]: true }));
                                    setDropdownSearch(prev => ({ ...prev, [item.uid]: '' }));
                                  }}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setDropdownOpen(prev => ({ ...prev, [item.uid]: false }));
                                    }, 250);
                                  }}
                                  className="bg-transparent border-none outline-none text-white text-xs w-full cursor-text"
                                />
                                <span className="text-[#555] text-[10px] ml-1 shrink-0">▼</span>
                              </div>

                              {dropdownOpen[item.uid] && (
                                <div className="absolute left-0 right-0 z-30 mt-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl max-h-[200px] overflow-y-auto scrollbar-thin divide-y divide-white/5 animate-fadeIn">
                                  {(() => {
                                    const query = (dropdownSearch[item.uid] ?? '').toLowerCase().trim();
                                    const filtered = products.filter(p =>
                                      p.status === 'active' &&
                                      p.name.toLowerCase().includes(query)
                                    );

                                    return (
                                      <>
                                        {filtered.length === 0 ? (
                                          <div className="px-3 py-2.5 text-xs text-[#555] italic">Brak pasujących produktów</div>
                                        ) : (
                                          filtered.map(p => (
                                            <div
                                              key={p.id}
                                              onClick={() => {
                                                updateBulkItem(item.uid, 'productId', p.id);
                                                if (p.supplier && !bulkDelivery.supplier) {
                                                  setBulkDelivery(prev => ({ ...prev, supplier: p.supplier }));
                                                }
                                                setDropdownSearch(prev => ({ ...prev, [item.uid]: '' }));
                                                setDropdownOpen(prev => ({ ...prev, [item.uid]: false }));
                                              }}
                                              className="px-3 py-2.5 text-xs hover:bg-brand-gold/10 hover:text-brand-gold cursor-pointer transition flex justify-between items-center text-white"
                                            >
                                              <span className="font-semibold">{p.name}</span>
                                              <span className="text-[10px] text-[#666] font-mono bg-white/5 px-1.5 py-0.5 rounded">{p.unit}</span>
                                            </div>
                                          ))
                                        )}
                                        <div
                                          onClick={() => {
                                            setQuickAddTargetUid(item.uid);
                                            setQuickSupplierCustom(false);
                                            setQuickLocationCustom(false);
                                            setQuickAddProduct(true);
                                            setDropdownOpen(prev => ({ ...prev, [item.uid]: false }));
                                          }}
                                          className="px-3 py-2.5 text-xs bg-black/40 hover:bg-brand-gold/20 text-brand-gold font-bold cursor-pointer transition flex items-center gap-1.5"
                                        >
                                          ➕ Dodaj nowy produkt...
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                          {idx === 0 && <p className="text-[9px] text-[#444] mt-0.5">Wyszukaj lub dodaj nowy produkt</p>}
                        </div>

                        {/* Ilość */}
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="number" min="0.01" step="any" required={item.productId !== ''}
                            value={item.quantity}
                            onChange={e => updateBulkItem(item.uid, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs text-center font-bold focus:outline-none focus:border-brand-gold transition"
                          />
                          {idx === 0 && <p className="text-[9px] text-[#444] mt-0.5 text-center">Ilość</p>}
                        </div>

                        {/* Nr partii */}
                        <div className="col-span-4 sm:col-span-2">
                          <input
                            type="text"
                            placeholder={selectedProd?.hasExpiry ? 'LOT-...' : '-'}
                            disabled={!selectedProd?.hasExpiry}
                            value={item.batchNumber}
                            onChange={e => updateBulkItem(item.uid, 'batchNumber', e.target.value)}
                            className="w-full px-2 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                          {idx === 0 && <p className="text-[9px] text-[#444] mt-0.5">Nr partii</p>}
                        </div>

                        {/* Data ważności */}
                        <div className="col-span-3 sm:col-span-2">
                          <input
                            type="date"
                            disabled={!selectedProd?.hasExpiry}
                            required={!!selectedProd?.hasExpiry}
                            value={item.expiryDate}
                            onChange={e => updateBulkItem(item.uid, 'expiryDate', e.target.value)}
                            className="w-full px-2 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500 transition disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                          {idx === 0 && <p className="text-[9px] text-[#444] mt-0.5">Data ważności</p>}
                        </div>

                        {/* Usuń */}
                        <div className="col-span-1 sm:col-span-1 flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => removeBulkItem(item.uid)}
                            disabled={bulkItems.length === 1}
                            className="p-1.5 text-[#444] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Podsumowanie koszyka */}
                {bulkItems.some(i => i.productId !== '') && (
                  <div className="mt-2 p-3 bg-brand-gold/5 border border-brand-gold/20 rounded-xl">
                    <p className="text-[10px] font-bold text-brand-gold uppercase tracking-wider mb-1">Podsumowanie dostawy:</p>
                    <div className="space-y-1">
                      {bulkItems.filter(i => i.productId !== '').map(i => {
                        const p = products.find(pr => pr.id === i.productId);
                        return p ? (
                          <div key={i.uid} className="flex justify-between text-[11px] text-[#a0a0a0]">
                            <span className="font-semibold text-white">{p.name}</span>
                            <span className="font-black text-green-400">+{i.quantity} {p.unit}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Zdjęcie + Zatwierdź */}
              <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                <div className={`p-3 rounded-xl border transition-all ${deliverFile ? 'border-green-500/30 bg-green-500/5' : deliverFileWarning ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10'}`}>
                  <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1.5 ${deliverFile ? 'text-green-400' : deliverFileWarning ? 'text-amber-400' : 'text-[#888]'}`}>
                    {deliverFile ? '✅ Zdjęcie faktury / paragonu dołączone' : '📷 Zdjęcie faktury / paragonu (zalecane)'}
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={e => { const f = e.target.files?.[0] || null; setDeliverFile(f); if (f) setDeliverFileWarning(false); }}
                    className="w-full text-xs text-[#a0a0a0] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-brand-gold/20 file:text-brand-gold hover:file:bg-brand-gold/30 file:cursor-pointer cursor-pointer"
                  />
                  {deliverFile && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      <span>{deliverFile.name} ({(deliverFile.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  )}
                  {!deliverFile && deliverFileWarning && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Brak zdjęcia — wymagane potwierdzenie przy wysyłce</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetBulkDelivery}
                    className="px-4 py-2.5 text-xs font-bold text-[#888] hover:text-white border border-white/10 rounded-lg transition cursor-pointer"
                  >
                    Wyczyść
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || bulkItems.every(i => i.productId === '')}
                    className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-brand-dark font-black rounded-lg uppercase tracking-wider text-xs transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-brand-dark" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Zatwierdź dostawę ({bulkItems.filter(i => i.productId !== '').length} poz.)
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <p className="text-xs text-[#555] italic">Brak uprawnień do rejestrowania dostaw.</p>
          )}

          {/* Rejestr historyczny dostaw */}
          <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Historia przyjęć dostaw</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                    <th className="pb-3">Data</th>
                    <th className="pb-3">Produkt</th>
                    <th className="pb-3 text-right">Ilość</th>
                    <th className="pb-3">Dostawca</th>
                    <th className="pb-3">Użytkownik</th>
                    <th className="pb-3">Uwagi</th>
                    <th className="pb-3 text-center">Załącznik</th>
                    <th className="pb-3 text-center">Audyt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                  {history.filter(h => h.type === 'delivery').length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center italic text-[#555]">Brak danych w historii dostaw.</td>
                    </tr>
                  ) : (
                    history.filter(h => h.type === 'delivery').map(h => (
                      <tr key={h.id} className="hover:bg-white/2 transition">
                        <td className="py-3 text-[11px] font-mono">
                          {new Date(h.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 font-semibold text-white">{h.productName}</td>
                        <td className="py-3 text-right font-black text-green-400">+{h.quantity} {h.unit}</td>
                        <td className="py-3 text-[11px] font-bold text-white">{h.source}</td>
                        <td className="py-3 text-[11px]">{h.userName}</td>
                        <td className="py-3 text-[10px] text-[#666] max-w-[150px] truncate" title={h.remarks}>{h.remarks || '-'}</td>
                        <td className="py-3 text-center">
                          {h.attachmentUrl ? (
                            <a
                              href={h.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-brand-gold hover:text-yellow-400 font-bold transition text-[10px] uppercase"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Pokaż</span>
                            </a>
                          ) : (
                            <span className="text-[#444] text-[10px] italic">Brak</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedHistoryItem(h)}
                            className="p-1 hover:bg-white/5 rounded text-[#a0a0a0] hover:text-brand-gold transition cursor-pointer"
                            title="Pokaż szczegóły (Lupka)"
                          >
                            <Search className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}




      {/* ------------------------------------------------------------- */}
      {/* KARTA: WYDANIA NA LOKALE                                      */}
      {/* ------------------------------------------------------------- */}

      {/* ------------------------------------------------------------- */}
      {/* KARTA: WYDANIA NA LOKALE                                      */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'issues' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formularz wprowadzania wydania */}
          <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 h-fit">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand-red" />
              <span>Zarejestruj wydanie towaru</span>
            </h3>
            
            {canIssue ? (
              <form onSubmit={handleIssueProduct} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Produkt z katalogu</label>
                  <select
                    value={showIssueModal || ''}
                    onChange={e => setShowIssueModal(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="">-- Wybierz artykuł --</option>
                    {products.filter(p => p.status === 'active' && p.currentStock > 0).map(p => (
                      <option key={p.id} value={p.id}>{p.name} (Dostępne: {p.currentStock} {p.unit})</option>
                    ))}
                  </select>
                </div>

                {showIssueModal && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Ilość wydawana</label>
                        <input
                          type="number"
                          min="0.01"
                          max={products.find(p => p.id === showIssueModal)?.currentStock || undefined}
                          step="any"
                          required
                          value={issueForm.quantity}
                          onChange={e => setIssueForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                          className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Lokal docelowy</label>
                        <select
                          value={issueForm.venue}
                          onChange={e => setIssueForm(prev => ({ ...prev, venue: e.target.value }))}
                          required
                          className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                        >
                          <option value="Kraków Rynek">Kraków Rynek</option>
                          <option value="Warszawa Bemowo">Warszawa Bemowo</option>
                          <option value="Katowice Centrum">Katowice Centrum</option>
                          <option value="Gdańsk Wrzeszcz">Gdańsk Wrzeszcz</option>
                        </select>
                      </div>
                    </div>

                    {products.find(p => p.id === showIssueModal)?.hasExpiry && (
                      <div className="p-3 bg-brand-gold/5 border border-brand-gold/10 rounded-xl text-[11px] leading-relaxed text-[#aaa] animate-fadeIn">
                        <span className="font-bold text-brand-gold block mb-1">💡 Zasada FEFO (Wydanie z najkrótszym terminem):</span>
                        System automatycznie ściągnie stany z najwcześniej kończących się partii tego produktu. Nie musisz wybierać partii ręcznie.
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Uwagi / Protokół / Kto pobrał</label>
                        <textarea
                          placeholder="np. Pobrał instruktor Jan Kowalski na bar..."
                          value={issueForm.remarks}
                          onChange={e => setIssueForm(prev => ({ ...prev, remarks: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-brand-red hover:bg-red-600 text-white font-black rounded-lg uppercase tracking-wider text-xs transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      {actionLoading ? 'Zapisywanie...' : 'Zatwierdź wydanie na lokal'}
                    </button>
                  </>
                )}
              </form>
            ) : (
              <p className="text-xs text-[#555] italic">Brak uprawnień do rejestrowania wydań.</p>
            )}
          </div>

          {/* Rejestr historyczny wydań */}
          <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Historia wydań na lokale</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                    <th className="pb-3">Data</th>
                    <th className="pb-3">Produkt</th>
                    <th className="pb-3 text-right">Ilość</th>
                    <th className="pb-3">Lokal docelowy</th>
                    <th className="pb-3">Użytkownik</th>
                    <th className="pb-3">Uwagi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                  {history.filter(h => h.type === 'issue').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center italic text-[#555]">Brak danych w historii wydań.</td>
                    </tr>
                  ) : (
                    history.filter(h => h.type === 'issue').map(h => (
                      <tr key={h.id} className="hover:bg-white/2 transition">
                        <td className="py-3 text-[11px] font-mono">
                          {new Date(h.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 font-semibold text-white">{h.productName}</td>
                        <td className="py-3 text-right font-black text-brand-red">{h.quantity} {h.unit}</td>
                        <td className="py-3 text-[11px] font-bold text-white">{h.source}</td>
                        <td className="py-3 text-[11px]">{h.userName}</td>
                        <td className="py-3 text-[10px] text-[#666] max-w-[150px] truncate" title={h.remarks}>{h.remarks || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* KARTA: INWENTARYZACJE                                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'inventories' && (
        <div className="space-y-8">
          {/* Aktywny kreator inwentaryzacji (W TRAKCIE) */}
          {activeInventoryId && activeInventory ? (
            <div className="glass-card p-6 rounded-2xl border border-brand-gold/20 bg-brand-gold/[0.01] space-y-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-gold via-yellow-500 to-brand-gold" />
              
              <div className="flex justify-between items-start flex-wrap gap-4 border-b border-white/5 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                      activeInventory.header.type === 'spot' ? 'bg-orange-500/20 text-orange-400' : 'bg-brand-gold/20 text-brand-gold'
                    }`}>
                      Inwentaryzacja: {activeInventory.header.type === 'spot' ? 'WYBIÓRCZA (SPOT)' : 'PEŁNA'}
                    </span>
                    <span className="text-[10px] text-[#666] font-mono">ID sesji: {activeInventory.header.id}</span>
                  </div>
                  <h3 className="text-md font-bold text-white uppercase tracking-wider mt-1.5">
                    Przeprowadzanie spisu z natury
                  </h3>
                  <p className="text-[10px] text-[#888] mt-0.5">
                    Odpowiedzialny: {activeInventory.header.userName} | Kategoria: {activeInventory.header.categoryName || 'Wszystkie'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCancelInventory}
                    className="px-4 py-2 bg-brand-red/10 hover:bg-brand-red/20 border border-brand-red/20 hover:border-brand-red/30 text-brand-red text-xs font-bold rounded-lg uppercase tracking-wider transition cursor-pointer"
                  >
                    Anuluj sesję
                  </button>
                  <button
                    onClick={handleSaveInventoryDraft}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#222] hover:bg-[#333] border border-white/10 hover:border-white/20 text-white text-xs font-bold rounded-lg uppercase tracking-wider transition cursor-pointer"
                  >
                    Zapisz szkic
                  </button>
                  <button
                    onClick={handleSubmitInventory}
                    disabled={actionLoading}
                    className="px-6 py-2 bg-gradient-to-r from-brand-gold to-yellow-500 text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition cursor-pointer"
                  >
                    Zatwierdź i zamknij
                  </button>
                </div>
              </div>

              {/* Lista pozycji do spisania */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                      <th className="pb-3">Produkt</th>
                      <th className="pb-3 text-right">Stan systemowy</th>
                      <th className="pb-3 text-center">Stan rzeczywisty (Wpisz)</th>
                      <th className="pb-3 text-right">Różnica</th>
                      <th className="pb-3">Komentarz / Uwagi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                    {activeInventory.items?.map((item: any) => {
                      const state = inventoryFormValues[item.productId] || { actualStock: item.systemStock, remarks: '' };
                      const diff = state.actualStock - item.systemStock;
                      
                      return (
                        <tr key={item.productId} className="hover:bg-white/[0.01]">
                          <td className="py-3.5">
                            <span className="font-extrabold text-white block">{item.productName}</span>
                          </td>
                          <td className="py-3.5 text-right font-black text-sm text-white pr-4">
                            {item.systemStock} {item.unit}
                          </td>
                          <td className="py-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                step="any"
                                value={state.actualStock}
                                onChange={e => {
                                  const val = e.target.value === '' ? 0 : Number(e.target.value);
                                  setInventoryFormValues(prev => ({
                                    ...prev,
                                    [item.productId]: { ...prev[item.productId], actualStock: val }
                                  }));
                                }}
                                className="w-20 px-2 py-1.5 bg-[#141414] border border-white/10 rounded-lg text-center font-bold text-white text-xs focus:outline-none focus:border-brand-gold"
                              />
                              <span className="text-[10px] text-[#555] font-semibold">{item.unit}</span>
                            </div>
                          </td>
                          <td className="py-3.5 text-right font-black pr-4">
                            {diff === 0 ? (
                              <span className="text-[#444] font-mono">0</span>
                            ) : diff > 0 ? (
                              <span className="text-green-400 font-mono">+{diff}</span>
                            ) : (
                              <span className="text-brand-red font-mono">{diff}</span>
                            )}
                          </td>
                          <td className="py-3.5">
                            <input
                              type="text"
                              placeholder="np. zgubione, stłuczone..."
                              value={state.remarks}
                              onChange={e => {
                                setInventoryFormValues(prev => ({
                                  ...prev,
                                  [item.productId]: { ...prev[item.productId], remarks: e.target.value }
                                }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder-[#333] focus:outline-none focus:border-brand-gold"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Lista historyczna oraz przyciski rozpoczęcia */
            <div className="space-y-6">
              {canInventory && (
                <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Inicjalizacja nowego spisu z natury</h3>
                    <p className="text-[11px] text-[#888] mt-0.5">
                      Rozpocznij spis kontrolny dla całego magazynu lub wybierz konkretną kategorię towarową.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStartFullInventory(null)}
                      className="px-4 py-2.5 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition cursor-pointer"
                    >
                      + Rozpocznij pełną inwentaryzację
                    </button>
                    {categories.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleStartFullInventory(c.id)}
                        className="px-3.5 py-2.5 bg-[#141414] hover:bg-[#1e1e1e] border border-white/5 text-white text-xs font-semibold rounded-lg uppercase tracking-wider transition cursor-pointer"
                      >
                        kategoria: {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabela historycznych inwentaryzacji */}
              <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Archiwum inwentaryzacji</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                        <th className="pb-3">Data spisu</th>
                        <th className="pb-3">Typ</th>
                        <th className="pb-3">Zakres</th>
                        <th className="pb-3">Przeprowadzający</th>
                        <th className="pb-3 text-right">Liczba pozycji</th>
                        <th className="pb-3 text-right">Wykryte różnice</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Akcje</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                      {inventories.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center italic text-[#555]">Brak ukończonych inwentaryzacji w historii.</td>
                        </tr>
                      ) : (
                        inventories.map(inv => (
                          <tr key={inv.id} className="hover:bg-white/2 transition">
                            <td className="py-3 text-[11px] font-mono">
                              {new Date(inv.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded ${
                                inv.type === 'spot' ? 'bg-orange-500/10 text-orange-400' : 'bg-brand-gold/10 text-brand-gold'
                              }`}>
                                {inv.type === 'spot' ? 'Wybiórcza' : 'Pełna'}
                              </span>
                            </td>
                            <td className="py-3 font-semibold text-white">{inv.categoryName || 'Pełny Magazyn'}</td>
                            <td className="py-3 text-[11px]">{inv.userName}</td>
                            <td className="py-3 text-right font-bold text-white pr-4">{inv.itemCount}</td>
                            <td className="py-3 text-right font-bold pr-4">
                              {inv.status === 'draft' ? (
                                <span className="text-[#444] italic">w trakcie</span>
                              ) : inv.diffCount > 0 ? (
                                <span className="text-brand-red">{inv.diffCount} pozycji</span>
                              ) : (
                                <span className="text-green-400">brak różnic</span>
                              )}
                            </td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                                inv.status === 'submitted' ? 'bg-green-500/10 text-green-400' : 'bg-brand-gold/10 text-brand-gold animate-pulse'
                              }`}>
                                {inv.status === 'submitted' ? 'Zatwierdzona' : 'Szkic'}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              {inv.status === 'draft' ? (
                                <button
                                  onClick={() => handleResumeInventory(inv.id)}
                                  className="px-2.5 py-1 bg-brand-gold hover:opacity-90 text-brand-dark text-[10px] font-black rounded uppercase cursor-pointer"
                                >
                                  Wznów
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleViewInventoryDetails(inv.id)}
                                  className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[#e0e0e0] text-[10px] font-bold rounded uppercase cursor-pointer transition border border-white/5"
                                >
                                  Szczegóły
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Nakładka Szczegółów ukończonej inwentaryzacji */}
          {viewingInventoryDetails && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="glass-card max-w-4xl w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto scrollbar-thin">
                <div className="flex justify-between items-start border-b border-white/5 pb-3">
                  <div>
                    <h3 className="text-md font-bold text-white uppercase tracking-wider">Szczegóły inwentaryzacji</h3>
                    <p className="text-[10px] text-[#888] mt-0.5">
                      Wykonawca: {viewingInventoryDetails.header.userName} | Zakres: {viewingInventoryDetails.header.categoryName || 'Pełny Magazyn'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setViewingInventoryDetails(null)}
                    className="p-1.5 bg-[#141414] hover:bg-[#222] border border-white/5 hover:border-white/10 rounded-lg text-white transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                        <th className="pb-3">Produkt</th>
                        <th className="pb-3 text-right">Stan systemowy</th>
                        <th className="pb-3 text-right">Stan rzeczywisty</th>
                        <th className="pb-3 text-right">Różnica</th>
                        <th className="pb-3">Komentarz / Uwagi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                      {viewingInventoryDetails.items?.map((item: any) => (
                        <tr key={item.id}>
                          <td className="py-2.5 font-bold text-white">{item.productName}</td>
                          <td className="py-2.5 text-right font-mono text-[#666]">{item.systemStock} {item.unit}</td>
                          <td className="py-2.5 text-right font-bold text-white pr-4">{item.actualStock} {item.unit}</td>
                          <td className="py-2.5 text-right font-black pr-4">
                            {item.difference === 0 ? (
                              <span className="text-[#333]">0</span>
                            ) : item.difference > 0 ? (
                              <span className="text-green-400">+{item.difference}</span>
                            ) : (
                              <span className="text-brand-red">{item.difference}</span>
                            )}
                          </td>
                          <td className="py-2.5 text-[11px] text-[#555]">{item.remarks || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/5">
                  <button
                    onClick={() => setViewingInventoryDetails(null)}
                    className="px-6 py-2.5 bg-[#141414] hover:bg-[#222] text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer border border-white/5 transition"
                  >
                    Zamknij
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* KARTA: KATEGORIE MAGAZYNOWE                                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'categories' && canManage && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              {editingCategoryId ? 'Edytuj kategorię' : 'Dodaj nową kategorię'}
            </h3>
            
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Nazwa kategorii</label>
                <input
                  type="text"
                  required
                  placeholder="np. Elementy Mechaniczne, Smary..."
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 bg-brand-gold hover:opacity-95 text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider transition cursor-pointer"
                >
                  {editingCategoryId ? 'Zapisz zmianę' : 'Dodaj kategorię'}
                </button>
                {editingCategoryId && (
                  <button
                    type="button"
                    onClick={() => { setEditingCategoryId(null); setNewCategoryName(''); }}
                    className="px-4 py-2.5 bg-[#222] text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
                  >
                    Anuluj
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Istniejące Kategorie</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {categories.map((c) => (
                <div key={c.id} className="flex justify-between items-center p-3 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 rounded-xl transition">
                  <span className="font-extrabold text-white">{c.name}</span>
                  <button
                    onClick={() => { setEditingCategoryId(c.id); setNewCategoryName(c.name); }}
                    className="p-1.5 bg-[#141414] hover:bg-[#222] text-[#888] hover:text-white rounded border border-white/5 hover:border-white/10 transition cursor-pointer"
                    title="Edytuj nazwę"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* KARTA: HISTORIA OPERACJI MAGAZYNOWYCH                         */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* Pasek filtrów historii */}
          <div className="glass-card p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#555]" />
              <input
                type="text"
                placeholder="Szukaj po nazwie produktu..."
                value={histProductFilter}
                onChange={e => setHistProductFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder-[#555] focus:outline-none focus:border-brand-gold transition"
              />
            </div>
            
            <select
              value={histTypeFilter}
              onChange={e => setHistTypeFilter(e.target.value)}
              className="w-48 px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-brand-gold transition"
            >
              <option value="">Wszystkie typy</option>
              <option value="delivery">Przyjęcia / Dostawy</option>
              <option value="issue">Wydania na lokale</option>
              <option value="correction">Korekty inwentaryzacji</option>
            </select>

            {canManage && (
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={actionLoading}
                className="px-4 py-2 bg-brand-red/10 hover:bg-brand-red/20 border border-brand-red/30 text-brand-red rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 uppercase tracking-wider"
              >
                <span>🗑️ Wyczyść historię</span>
              </button>
            )}
          </div>

          {/* Tabela historii ruchów */}
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.01] text-[9px] font-extrabold text-[#555] uppercase tracking-wider">
                    <th className="p-4">Data i godzina</th>
                    <th className="p-4">Nazwa artykułu</th>
                    <th className="p-4">Typ operacji</th>
                    <th className="p-4 text-right">Ilość</th>
                    <th className="p-4">Dostawca / Lokal docelowy</th>
                    <th className="p-4">Użytkownik</th>
                    <th className="p-4">Uwagi</th>
                    <th className="p-4 text-center">Faktura</th>
                    <th className="p-4 text-center">Audyt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center italic text-[#555]">Brak danych w historii operacji magazynowych.</td>
                    </tr>
                  ) : (
                    filteredHistory.map((h) => {
                      const isPositive = h.quantity > 0;
                      
                      return (
                        <tr key={h.id} className="hover:bg-white/[0.01]">
                          <td className="p-4 text-[11px] font-mono">
                            {new Date(h.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4">
                            <div className="space-y-0.5">
                              <span className="font-extrabold text-white block">{h.productName}</span>
                              {h.batchNumber && h.batchNumber !== 'DEFAULT' && (
                                <span className="text-[9px] text-[#666] font-mono">Partia: {h.batchNumber}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              h.type === 'delivery' 
                                ? 'bg-green-500/10 text-green-400' 
                                : h.type === 'issue'
                                  ? 'bg-brand-red/10 text-brand-red'
                                  : 'bg-brand-gold/10 text-brand-gold'
                            }`}>
                              {h.type === 'delivery' ? 'Przyjęcie' : h.type === 'issue' ? 'Wydanie' : 'Korekta'}
                            </span>
                          </td>
                          <td className={`p-4 text-right font-black text-sm ${isPositive ? 'text-green-400' : 'text-brand-red'}`}>
                            {isPositive ? '+' : ''}{h.quantity} {h.unit}
                          </td>
                          <td className="p-4 font-bold text-white">{h.source || '-'}</td>
                          <td className="p-4 text-[11px]">{h.userName}</td>
                          <td className="p-4 text-[11px] text-[#555] max-w-[200px] truncate" title={h.remarks}>{h.remarks || '-'}</td>
                          <td className="p-4 text-center">
                            {h.attachmentUrl ? (
                              <a
                                href={h.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-brand-gold hover:text-yellow-400 font-bold transition text-[10px] uppercase"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Pokaż</span>
                              </a>
                            ) : (
                              <span className="text-[#444] text-[10px] italic">Brak</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedHistoryItem(h)}
                              className="p-1 hover:bg-white/5 rounded text-[#a0a0a0] hover:text-brand-gold transition cursor-pointer"
                              title="Pokaż szczegóły (Lupka)"
                            >
                              <Search className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: DODAWANIE / EDYCJA PRODUKTU                            */}
      {/* ------------------------------------------------------------- */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-2xl w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 relative overflow-hidden animate-fadeIn">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
            
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-brand-gold" />
                <span>{editingProduct ? 'Edycja danych produktu' : 'Dodawanie nowego produktu'}</span>
              </h3>
              <button 
                onClick={() => setShowProductModal(false)}
                className="p-1.5 bg-[#141414] hover:bg-[#222] border border-white/5 hover:border-white/10 rounded-lg text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Nazwa produktu</label>
                  <input
                    type="text"
                    required
                    placeholder="np. Łożysko 6204, Olej 5W30..."
                    value={productForm.name}
                    onChange={e => setProductForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Kategoria artykułu</label>
                  <select
                    value={productForm.categoryId}
                    onChange={e => setProductForm(prev => ({ ...prev, categoryId: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="">-- Wybierz --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Jednostka miary</label>
                  <select
                    value={productForm.unit}
                    onChange={e => setProductForm(prev => ({ ...prev, unit: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="szt.">szt. (Sztuka)</option>
                    <option value="kg">kg (Kilogram)</option>
                    <option value="l">l (Litr)</option>
                    <option value="opak.">opak. (Opakowanie)</option>
                  </select>
                </div>

                 <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Dostawca główny</label>
                  {!supplierCustom ? (
                    <select
                      value={presetSuppliers.includes(productForm.supplier) ? productForm.supplier : productForm.supplier ? '__custom__' : ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setSupplierCustom(true);
                          setProductForm(prev => ({ ...prev, supplier: '' }));
                        } else {
                          setProductForm(prev => ({ ...prev, supplier: val }));
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    >
                      <option value="">-- Wybierz dostawcę --</option>
                      {presetSuppliers.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__custom__" className="text-brand-gold font-bold">✍️ Wpisz innego...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Wpisz nazwę dostawcy..."
                        value={productForm.supplier}
                        onChange={e => setProductForm(prev => ({ ...prev, supplier: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-[#141414] border border-brand-gold/30 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                      />
                      <button
                        type="button"
                        onClick={() => { setSupplierCustom(false); setProductForm(prev => ({ ...prev, supplier: presetSuppliers[0] || '' })); }}
                        className="px-2 py-1 text-[10px] text-brand-gold border border-brand-gold/10 hover:bg-brand-gold/10 rounded transition cursor-pointer"
                      >
                        Lista
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Sektor / Lokalizacja w magazynie</label>
                  {!locationCustom ? (
                    <select
                      value={presetLocations.includes(productForm.location) ? productForm.location : productForm.location ? '__custom__' : ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setLocationCustom(true);
                          setProductForm(prev => ({ ...prev, location: '' }));
                        } else {
                          setProductForm(prev => ({ ...prev, location: val }));
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    >
                      <option value="">-- Wybierz lokalizację --</option>
                      {presetLocations.map(l => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                      <option value="__custom__" className="text-brand-gold font-bold">✍️ Wpisz inną...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="np. Regał A-3..."
                        value={productForm.location}
                        onChange={e => setProductForm(prev => ({ ...prev, location: e.target.value }))}
                        className="flex-1 px-3 py-2 bg-[#141414] border border-brand-gold/30 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                      />
                      <button
                        type="button"
                        onClick={() => { setLocationCustom(false); setProductForm(prev => ({ ...prev, location: presetLocations[0] || '' })); }}
                        className="px-2 py-1 text-[10px] text-brand-gold border border-brand-gold/10 hover:bg-brand-gold/10 rounded transition cursor-pointer"
                      >
                        Lista
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Kod SKU (Opcjonalny)</label>
                  <input
                    type="text"
                    placeholder="np. MECH-LOZ-6204"
                    value={productForm.sku}
                    onChange={e => setProductForm(prev => ({ ...prev, sku: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-brand-red uppercase tracking-wider mb-1.5">Stan minimalny</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={productForm.minStock}
                      onChange={e => setProductForm(prev => ({ ...prev, minStock: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Stan maksymalny</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={productForm.maxStock}
                      onChange={e => setProductForm(prev => ({ ...prev, maxStock: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                    />
                  </div>
                </div>

                <div className="md:col-span-2 grid grid-cols-2 gap-4 bg-white/[0.01] border border-white/5 rounded-xl p-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={productForm.hasExpiry}
                      onChange={e => setProductForm(prev => ({ ...prev, hasExpiry: e.target.checked }))}
                      className="rounded border-white/10 bg-[#141414] text-brand-gold focus:ring-brand-gold"
                    />
                    <div>
                      <span className="block text-xs font-bold text-white">Termin ważności</span>
                      <span className="block text-[9px] text-[#555]">Włącz śledzenie dat przydatności i partii</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={productForm.autoSpotCheck}
                      onChange={e => setProductForm(prev => ({ ...prev, autoSpotCheck: e.target.checked }))}
                      className="rounded border-white/10 bg-[#141414] text-brand-gold focus:ring-brand-gold"
                    />
                    <div>
                      <span className="block text-xs font-bold text-brand-gold">Inwentaryzacja Wybiórcza</span>
                      <span className="block text-[9px] text-[#555]">Artykuł losowany pracownikom w grafiku</span>
                    </div>
                  </label>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Uwagi do produktu</label>
                  <textarea
                    placeholder="Opis, specyfikacja techniczna, dodatkowe uwagi..."
                    value={productForm.remarks}
                    onChange={e => setProductForm(prev => ({ ...prev, remarks: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-5 py-2.5 bg-[#141414] hover:bg-[#222] text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer border border-white/5 transition"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition cursor-pointer flex items-center justify-center"
                >
                  {actionLoading ? 'Zapisywanie...' : (editingProduct ? 'Zapisz zmiany' : 'Dodaj produkt')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stary modal dostawy z katalogu - przenosząca do zakładki Dostawy */}
      {/* (showDeliverModal obsługiwany przez openDeliverModal - teraz przekierowanie do bulk) */}


      {/* ------------------------------------------------------------- */}
      {/* MODAL: SZYBKIE WYDANIE (Z POZIOMU KATALOGU)                      */}
      {/* ------------------------------------------------------------- */}
      {showIssueModal && activeTab === 'products' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 relative overflow-hidden animate-fadeIn">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red to-orange-500" />
            
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Wydaj z magazynu: {products.find(p => p.id === showIssueModal)?.name}
              </h3>
              <button 
                onClick={() => setShowIssueModal(null)}
                className="p-1.5 bg-[#141414] hover:bg-[#222] rounded-lg text-white transition cursor-pointer border border-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleIssueProduct} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Ilość wydawana</label>
                  <input
                    type="number"
                    min="0.01"
                    max={products.find(p => p.id === showIssueModal)?.currentStock || undefined}
                    step="any"
                    required
                    value={issueForm.quantity}
                    onChange={e => setIssueForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Lokal docelowy</label>
                  <select
                    value={issueForm.venue}
                    onChange={e => setIssueForm(prev => ({ ...prev, venue: e.target.value }))}
                    required
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="Kraków Rynek">Kraków Rynek</option>
                    <option value="Warszawa Bemowo">Warszawa Bemowo</option>
                    <option value="Katowice Centrum">Katowice Centrum</option>
                    <option value="Gdańsk Wrzeszcz">Gdańsk Wrzeszcz</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Uwagi / Protokół / Kto pobrał</label>
                <textarea
                  placeholder="np. Pobrał instruktor Jan Kowalski..."
                  value={issueForm.remarks}
                  onChange={e => setIssueForm(prev => ({ ...prev, remarks: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(null)}
                  className="px-4 py-2 bg-[#141414] hover:bg-[#222] border border-white/5 text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-brand-red hover:bg-red-600 text-white text-xs font-black rounded-lg uppercase tracking-wider transition cursor-pointer"
                >
                  Zatwierdź
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: IMPORT Z EXCELA / CSV                                  */}
      {/* ------------------------------------------------------------- */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-4xl w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 relative overflow-hidden animate-fadeIn max-h-[90vh] flex flex-col">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-brand-gold to-green-500" />
            
            <div className="flex justify-between items-center border-b border-white/5 pb-3 shrink-0">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>📥 Import katalogu z Excela / CSV</span>
              </h3>
              <button
                onClick={() => { setShowImportModal(false); setImportPreview([]); setImportStatus(null); }}
                className="text-[#555] hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 py-4 overflow-y-auto flex-1 scrollbar-thin pr-1">
              <div className="p-4 bg-white/2 rounded-xl border border-white/5 space-y-3">
                <p className="text-xs text-[#a0a0a0] leading-relaxed">
                  Możesz zaimportować produkty masowo z pliku Excel (<code className="text-brand-gold font-mono bg-white/5 px-1 py-0.5 rounded">.xlsx</code>, <code className="text-brand-gold font-mono bg-white/5 px-1 py-0.5 rounded">.xls</code>) lub <code className="text-brand-gold font-mono bg-white/5 px-1 py-0.5 rounded">.csv</code>. System dopasuje kolumny automatycznie na podstawie nagłówków.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] bg-[#141414] p-3 rounded-lg border border-white/5 font-mono text-[#777]">
                  <div><span className="text-white font-bold">Nazwa</span> (wymagane)</div>
                  <div><span className="text-white font-bold">Kategoria</span> (wymagane)</div>
                  <div><span className="text-[#a0a0a0]">Jednostka</span> (np. szt.)</div>
                  <div><span className="text-[#a0a0a0]">Dostawca</span></div>
                  <div><span className="text-[#a0a0a0]">SKU</span></div>
                  <div><span className="text-[#a0a0a0]">Lokalizacja</span> (półka)</div>
                  <div><span className="text-[#a0a0a0]">Stan początkowy</span></div>
                  <div><span className="text-[#a0a0a0]">Min / Max stan</span></div>
                </div>
              </div>

              {/* Input pliku */}
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-white/10 rounded-xl hover:border-brand-gold/40 transition bg-[#121212]/50 relative group">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileImportChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <span className="text-2xl mb-1">📁</span>
                <span className="text-xs text-[#a0a0a0] font-semibold group-hover:text-brand-gold transition">Wybierz plik Excel lub przeciągnij go tutaj</span>
                <span className="text-[10px] text-[#555] mt-1 font-mono">xlsx, xls, csv</span>
              </div>

              {importStatus && (
                <div className={`p-3 rounded-lg border text-xs font-bold ${
                  importStatus.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-brand-red/10 border-brand-red/20 text-brand-red'
                }`}>
                  {importStatus.text}
                </div>
              )}

              {/* Podgląd przed importem */}
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Podgląd danych ({importPreview.length} wierszy)</h4>
                  <div className="border border-white/5 rounded-lg overflow-hidden max-h-[250px] overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/5 text-[#888] font-bold">
                          <th className="p-2">Nazwa</th>
                          <th className="p-2">Kategoria</th>
                          <th className="p-2 text-center">Jedn.</th>
                          <th className="p-2 text-right">Stan pocz.</th>
                          <th className="p-2">Dostawca</th>
                          <th className="p-2">Lokalizacja</th>
                          <th className="p-2 text-center">Ważność</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-[#a0a0a0] bg-white/[0.01]">
                        {importPreview.map((item, idx) => (
                          <tr key={idx} className="hover:bg-white/2">
                            <td className="p-2 text-white font-semibold truncate max-w-[150px]" title={item.name}>{item.name}</td>
                            <td className="p-2 truncate max-w-[100px]" title={item.categoryName}>{item.categoryName}</td>
                            <td className="p-2 text-center">{item.unit}</td>
                            <td className="p-2 text-right font-bold text-white">{item.initialStock}</td>
                            <td className="p-2 truncate max-w-[100px]">{item.supplier || '-'}</td>
                            <td className="p-2 truncate max-w-[100px]">{item.location || '-'}</td>
                            <td className="p-2 text-center">{item.hasExpiry ? 'TAK' : 'NIE'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/5 shrink-0">
              <button
                type="button"
                onClick={() => { setShowImportModal(false); setImportPreview([]); setImportStatus(null); }}
                className="px-4 py-2 bg-[#141414] hover:bg-[#222] border border-white/5 text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
              >
                Zamknij
              </button>
              {importPreview.length > 0 && (
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-brand-gold hover:bg-yellow-500 text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider transition cursor-pointer"
                >
                  {actionLoading ? 'Trwa import...' : `Zatwierdź i Dodaj (${importPreview.length})`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: SZCZEGÓŁOWY AUDYT OPERACJI (LUPKA)                      */}
      {/* ------------------------------------------------------------- */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 relative overflow-hidden animate-fadeIn">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red via-brand-gold to-brand-red" />
            
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4 text-brand-gold" />
                <span>Szczegóły operacji</span>
              </h3>
              <button onClick={() => setSelectedHistoryItem(null)} className="text-[#555] hover:text-white transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 py-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-white/2 p-3 rounded-xl border border-white/5">
                <div>
                  <span className="text-[#666] block uppercase tracking-wider text-[9px] font-bold">Data i godzina</span>
                  <span className="text-white font-mono font-bold">
                    {new Date(selectedHistoryItem.date).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-[#666] block uppercase tracking-wider text-[9px] font-bold">Typ operacji</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase inline-block mt-0.5 ${
                    selectedHistoryItem.type === 'delivery' 
                      ? 'bg-green-500/10 text-green-400' 
                      : selectedHistoryItem.type === 'issue'
                        ? 'bg-brand-red/10 text-brand-red'
                        : 'bg-brand-gold/10 text-brand-gold'
                  }`}>
                    {selectedHistoryItem.type === 'delivery' ? 'Przyjęcie dostawy' : selectedHistoryItem.type === 'issue' ? 'Wydanie na lokal' : 'Korekta stanu'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-[#666] block uppercase tracking-wider text-[9px] font-bold">Produkt</span>
                  <span className="text-white font-extrabold text-sm">{selectedHistoryItem.productName}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#666] block uppercase tracking-wider text-[9px] font-bold">Ilość</span>
                    <span className={`text-sm font-black ${selectedHistoryItem.quantity > 0 ? 'text-green-400' : 'text-brand-red'}`}>
                      {selectedHistoryItem.quantity > 0 ? '+' : ''}{selectedHistoryItem.quantity} {selectedHistoryItem.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#666] block uppercase tracking-wider text-[9px] font-bold">Partia</span>
                    <span className="text-white font-mono">{selectedHistoryItem.batchNumber || '-'}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-3 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#666] block uppercase tracking-wider text-[9px] font-bold">Dostawca / Lokal docelowy</span>
                    <span className="text-white font-bold">{selectedHistoryItem.source || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[#666] block uppercase tracking-wider text-[9px] font-bold">Zarejestrował(a)</span>
                    <span className="text-white font-bold">{selectedHistoryItem.userName}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[#666] block uppercase tracking-wider text-[9px] font-bold">Uwagi</span>
                  <p className="text-white bg-white/2 p-2.5 rounded-lg border border-white/5 italic whitespace-pre-wrap">{selectedHistoryItem.remarks || 'Brak uwag'}</p>
                </div>
              </div>

              {/* Załącznik (faktura/paragon) */}
              {selectedHistoryItem.attachmentUrl && (
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <span className="text-[#666] block uppercase tracking-wider text-[9px] font-bold">Zdjęcie faktury / Paragonu</span>
                  <div className="relative border border-white/10 rounded-xl overflow-hidden bg-black max-h-[180px] flex items-center justify-center group">
                    <img 
                      src={selectedHistoryItem.attachmentUrl} 
                      alt="Faktura" 
                      className="max-h-[180px] object-contain hover:scale-105 transition duration-300"
                    />
                    <a
                      href={selectedHistoryItem.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold gap-2 transition cursor-pointer text-xs"
                    >
                      Otwórz w pełnym oknie
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/5">
              <button
                type="button"
                onClick={() => setSelectedHistoryItem(null)}
                className="px-5 py-2 bg-[#141414] hover:bg-[#222] border border-white/5 text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
              >
                Zamknij
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
