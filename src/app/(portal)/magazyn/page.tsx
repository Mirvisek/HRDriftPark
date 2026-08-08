'use client';

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
  deliverProductAction, 
  issueProductAction, 
  startInventoryAction, 
  saveInventoryDraftAction, 
  submitInventoryAction, 
  getInventoryHistoryAction, 
  getInventoryDetailsAction, 
  cancelInventoryAction,
  getWarehouseDashboardAction, 
  getWarehouseHistoryAction 
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

  // Formularze szybkiego ruchu
  const [showDeliverModal, setShowDeliverModal] = useState<number | null>(null); // productId
  const [deliverForm, setDeliverForm] = useState({
    quantity: 1,
    supplier: '',
    batchNumber: '',
    expiryDate: '',
    documentNumber: '',
    remarks: ''
  });

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
      const [categoriesRes, productsRes, dashboardRes, historyRes, inventoriesRes] = await Promise.all([
        getCategoriesAction(),
        getProductsAction(),
        getWarehouseDashboardAction(),
        getWarehouseHistoryAction(),
        getInventoryHistoryAction()
      ]);

      if (categoriesRes.success) setCategories(categoriesRes.data || []);
      if (productsRes.success) setProducts(productsRes.data || []);
      if (dashboardRes.success) setDashboard(dashboardRes.data || {});
      if (historyRes.success) setHistory(historyRes.data || []);
      if (inventoriesRes.success) setInventories(inventoriesRes.data || []);
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

  // -------------------------------------------------------------
  // OPERACJE DOSTAW
  // -------------------------------------------------------------
  const openDeliverModal = (p: any) => {
    setShowDeliverModal(p.id);
    setDeliverForm({
      quantity: 1,
      supplier: p.supplier || '',
      batchNumber: '',
      expiryDate: '',
      documentNumber: '',
      remarks: ''
    });
  };

  const handleDeliverProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDeliverModal) return;
    setActionLoading(true);
    try {
      const res = await deliverProductAction({
        productId: showDeliverModal,
        ...deliverForm
      });

      if (res.success) {
        setStatusMsg({ type: 'success', text: 'Zarejestrowano przyjęcie dostawy i zaktualizowano stan.' });
        setShowDeliverModal(null);
        // Przeładuj katalog, dashboard i historię
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
      setTimeout(() => setStatusMsg(null), 4000);
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
            <button
              onClick={openProductAdd}
              className="px-4 py-2.5 bg-gradient-to-r from-brand-red to-brand-gold text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider hover:opacity-95 transition transform hover:-translate-y-0.5 cursor-pointer flex items-center gap-2 shadow-lg shadow-brand-red/10"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Dodaj produkt</span>
            </button>
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
          { id: 'deliveries', label: 'Dostawy / Przyjęcia', icon: ArrowUpRight },
          { id: 'issues', label: 'Wydania na lokale', icon: ArrowDownRight },
          { id: 'inventories', label: 'Inwentaryzacje', icon: ClipboardCheck },
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
                                  onClick={() => openDeliverModal(p)}
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Formularz wprowadzania dostawy */}
          <div className="glass-card p-6 rounded-2xl border border-white/5 space-y-4 h-fit">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-green-400" />
              <span>Zarejestruj nową dostawę</span>
            </h3>
            
            {canDeliver ? (
              <form onSubmit={handleDeliverProduct} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Produkt z katalogu</label>
                  <select
                    value={showDeliverModal || ''}
                    onChange={e => {
                      const pId = Number(e.target.value);
                      setShowDeliverModal(pId);
                      const selectedProd = products.find(p => p.id === pId);
                      if (selectedProd) {
                        setDeliverForm(prev => ({ ...prev, supplier: selectedProd.supplier || '' }));
                      }
                    }}
                    required
                    className="w-full px-3 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  >
                    <option value="">-- Wybierz artykuł --</option>
                    {products.filter(p => p.status === 'active').map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                    ))}
                  </select>
                </div>

                {showDeliverModal && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Ilość przyjęta</label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={deliverForm.quantity}
                          onChange={e => setDeliverForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                          className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Dostawca</label>
                        <input
                          type="text"
                          required
                          placeholder="np. Makro"
                          value={deliverForm.supplier}
                          onChange={e => setDeliverForm(prev => ({ ...prev, supplier: e.target.value }))}
                          className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                        />
                      </div>
                    </div>

                    {products.find(p => p.id === showDeliverModal)?.hasExpiry && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl animate-fadeIn">
                        <div>
                          <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1.5">Numer Partii</label>
                          <input
                            type="text"
                            placeholder="np. LOT-4822"
                            value={deliverForm.batchNumber}
                            onChange={e => setDeliverForm(prev => ({ ...prev, batchNumber: e.target.value }))}
                            className="w-full px-3 py-2 bg-[#141414] border border-orange-500/20 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1.5">Data ważności</label>
                          <input
                            type="date"
                            required
                            value={deliverForm.expiryDate}
                            onChange={e => setDeliverForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                            className="w-full px-3 py-2 bg-[#141414] border border-orange-500/20 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500 transition"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Numer faktury / Dokumentu</label>
                        <input
                          type="text"
                          placeholder="np. FV/2026/08/948"
                          value={deliverForm.documentNumber}
                          onChange={e => setDeliverForm(prev => ({ ...prev, documentNumber: e.target.value }))}
                          className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Uwagi do przyjęcia</label>
                        <textarea
                          placeholder="Dodatkowe informacje..."
                          value={deliverForm.remarks}
                          onChange={e => setDeliverForm(prev => ({ ...prev, remarks: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-brand-dark font-black rounded-lg uppercase tracking-wider text-xs transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      {actionLoading ? 'Zapisywanie...' : 'Zatwierdź Przyjęcie dostawy'}
                    </button>
                  </>
                )}
              </form>
            ) : (
              <p className="text-xs text-[#555] italic">Brak uprawnień do rejestrowania dostaw.</p>
            )}
          </div>

          {/* Rejestr historyczny dostaw */}
          <div className="glass-card p-6 rounded-2xl border border-white/5 lg:col-span-2 space-y-4">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                  {history.filter(h => h.type === 'delivery').length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center italic text-[#555]">Brak danych w historii dostaw.</td>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-[#a0a0a0]">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center italic text-[#555]">Brak danych w historii operacji magazynowych.</td>
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
                  <input
                    type="text"
                    placeholder="np. Inter Cars, ABC Hurtownia..."
                    value={productForm.supplier}
                    onChange={e => setProductForm(prev => ({ ...prev, supplier: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Sektor / Lokalizacja w magazynie</label>
                  <input
                    type="text"
                    placeholder="np. Regał A-3"
                    value={productForm.location}
                    onChange={e => setProductForm(prev => ({ ...prev, location: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
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

      {/* ------------------------------------------------------------- */}
      {/* MODAL: SZYBKA DOSTAWA (Z POZIOMU KATALOGU)                      */}
      {/* ------------------------------------------------------------- */}
      {showDeliverModal && activeTab === 'products' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 relative overflow-hidden animate-fadeIn">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-emerald-400" />
            
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Przyjęcie dostawy: {products.find(p => p.id === showDeliverModal)?.name}
              </h3>
              <button 
                onClick={() => setShowDeliverModal(null)}
                className="p-1.5 bg-[#141414] hover:bg-[#222] rounded-lg text-white transition cursor-pointer border border-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDeliverProduct} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Ilość przyjęta</label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    required
                    value={deliverForm.quantity}
                    onChange={e => setDeliverForm(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Dostawca</label>
                  <input
                    type="text"
                    required
                    placeholder="np. Makro"
                    value={deliverForm.supplier}
                    onChange={e => setDeliverForm(prev => ({ ...prev, supplier: e.target.value }))}
                    className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                  />
                </div>
              </div>

              {products.find(p => p.id === showDeliverModal)?.hasExpiry && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1.5">Numer Partii</label>
                    <input
                      type="text"
                      placeholder="np. LOT-4822"
                      value={deliverForm.batchNumber}
                      onChange={e => setDeliverForm(prev => ({ ...prev, batchNumber: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#141414] border border-orange-500/20 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1.5">Data ważności</label>
                    <input
                      type="date"
                      required
                      value={deliverForm.expiryDate}
                      onChange={e => setDeliverForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#141414] border border-orange-500/20 rounded-lg text-white text-xs focus:outline-none focus:border-orange-500 transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wider mb-1.5">Faktura / Uwagi</label>
                <input
                  type="text"
                  placeholder="np. FV/2026/08/948"
                  value={deliverForm.documentNumber}
                  onChange={e => setDeliverForm(prev => ({ ...prev, documentNumber: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-brand-gold transition"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowDeliverModal(null)}
                  className="px-4 py-2 bg-[#141414] hover:bg-[#222] border border-white/5 text-white text-xs font-bold rounded-lg uppercase tracking-wider cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-green-500 hover:bg-green-600 text-brand-dark text-xs font-black rounded-lg uppercase tracking-wider transition cursor-pointer"
                >
                  Zatwierdź
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
    </div>
  );
}
