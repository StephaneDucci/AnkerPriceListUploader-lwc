// Import standard di LWC
import { LightningElement, wire, track } from 'lwc';

// Import delle risorse statiche
import sheetJS from '@salesforce/resourceUrl/SheetJS';
import { loadScript } from 'lightning/platformResourceLoader';

// Import dei metodi Apex
import importAnkerProducts from '@salesforce/apex/AnkerProductImporter.importAnkerProducts';
import resetAnkerProducts from '@salesforce/apex/AnkerProductImporter.resetAnkerProducts';
import importAnkerCategories from '@salesforce/apex/AnkerProductImporter.importAnkerCategories';
import resetAnkerCategories from '@salesforce/apex/AnkerProductImporter.resetAnkerCategories';
// import saveCategories from '@salesforce/apex/AnkerCategoryController.saveCategories';

export default class ExcelFileUploader extends LightningElement {
    @track fileName = 'Nessun file selezionato';
    @track data = [];
    @track importMessage = '';
    @track includeUnavailable = false; // ✅ Variabile per la checkbox
    sheetJsInitialized = false;

    connectedCallback() {
        if (!this.sheetJsInitialized) {
            loadScript(this, sheetJS)
                .then(() => {
                    this.sheetJsInitialized = true;
                    console.log('✅ SheetJS caricato con successo!');
                })
                .catch(error => {
                    console.error('❌ Errore nel caricamento di SheetJS:', error);
                });
        }
    }

    handleIncludeUnavailableChange(event) {
        this.includeUnavailable = event.target.checked;
        console.log(`🔘 Includere i prodotti N/A?: ${this.includeUnavailable}`);
    }

    handleFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            this.fileName = file.name;
            console.log(`📂 File selezionato: ${this.fileName}`);
            this.readExcelFile(file);
        }
    }

    handleMaxRecordsChange(event) {
        const value = event.target.value;
        if (value > 0) {
            this.maxRecords = parseInt(value, 10);
            console.log(`🔢 Numero massimo di record impostato: ${this.maxRecords}`);
        } else {
            this.maxRecords = 500; // Se il valore non è valido, usa quello di default
        }
    }

    readExcelFile(file) {
        if (!this.sheetJsInitialized) {
            console.error('❌ SheetJS non è stato caricato correttamente.');
            return;
        }

        this.data = []; // Pulisce i dati prima di caricarne di nuovi
        const reader = new FileReader();
        reader.onload = (event) => {
            console.log('📖 File letto correttamente, elaborazione in corso...');
            const binaryStr = event.target.result;
            let workbook;
            try {
                workbook = XLSX.read(binaryStr, { type: 'binary' });
                console.log('✅ Workbook caricato con successo.');
            } catch (error) {
                console.error('❌ Errore nella lettura del workbook:', error);
                return;
            }

            const sheetName = workbook.SheetNames[0]; // Prende il primo foglio
            const sheet = workbook.Sheets[sheetName];

            let jsonData;
            try {
                jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
            } catch (error) {
                console.error('❌ Errore nella conversione in JSON:', error);
                return;
            }

            if (!jsonData || jsonData.length === 0) {
                console.error('❌ Il file sembra vuoto.');
                return;
            }

            jsonData = jsonData.slice(11); // Rimuove le prime 11 righe di header

            if (!jsonData[0]) {
                console.error('❌ Nessuna intestazione trovata.');
                return;
            }

            const fieldMapping = {
                'sku': 'SKU',
                'description': 'Description',
                'case size': 'Case size',
                'size': 'Size',
                'alc %': 'Alc %',
                'price bottle': 'Price bottle',
                'comment/remark': 'Comment/remark',
                'main category': 'Main Category',
                'sub category': 'Sub Category',
                'coo': 'COO',
                'barcode bottle': 'Barcode bottle',
                'barcode outercase': 'Barcode Outercase'
            };

            const headers = jsonData[0].map(h => h ? h.toLowerCase().trim() : '');
            const mappedIndices = {};
            headers.forEach((h, index) => {
                if (fieldMapping[h]) {
                    mappedIndices[fieldMapping[h]] = index;
                }
            });

            if (Object.keys(mappedIndices).length === 0) {
                console.error('❌ Nessuna colonna valida trovata.');
                return;
            }

            const processedData = jsonData.slice(1).map(row => {
                let record = {};
                Object.keys(mappedIndices).forEach(field => {
                    record[field] = row[mappedIndices[field]] || '';
                });
                return record;
            });

            this.data = processedData;

            console.log("🔄 Chiamata a extractCategories()...");
            this.extractCategories();
        };

        reader.readAsBinaryString(file);
    }
    
    handleImport() {
        console.log('🔄 handleImport() chiamato!');
        console.log('📊 Dati totali prima del filtro:', this.data.length);
    
        if (!this.data || this.data.length === 0) {
            console.error('❌ Nessun dato disponibile per l\'importazione.');
            this.importMessage = '❌ Nessun dato da importare. Carica un file valido.';
            return;
        }

        // ✅ Trova dinamicamente il nome corretto del campo "Comment/Remark" ignorando maiuscole/minuscole
        let commentKey = Object.keys(this.data[0]).find(key => key.trim().toLowerCase() === 'comment/remark');
    
        // ✅ Applica il filtro per escludere i prodotti "Currently Not Available" se necessario
        let filteredData = this.data.filter(product => 
            this.includeUnavailable || (commentKey && String(product[commentKey]).trim().toLowerCase() !== 'currently not available')
        );
        
        console.log('📊 Dati totali dopo il filtro N/A:', filteredData.length);
        
        // ✅ Applica il limite dei record dopo il filtro
        let dataToImport = filteredData.slice(0, this.maxRecords);

        // console.log(`📊 Importando ${dataToImport.length} record su un totale di ${filteredData.length}`);
    
        importAnkerProducts({ productData: dataToImport })
            .then(result => {
                // console.log('📩 Risultato ricevuto da Apex:', result);
    
                if (!result || result.length === undefined) {
                    console.error('❌ La risposta di Apex non è valida:', result);
                    this.importMessage = '❌ Errore: risposta non valida da Salesforce.';
                    return;
                }
    
                console.log('✅ Importazione completata con successo!');
                this.importMessage = `✅ ${result.length} prodotti importati con successo!`;
            })
            .catch(error => {
                console.error('❌ Errore durante l\'importazione:', error);
    
                let errorMessage = '❌ Errore durante l\'importazione dei dati.';
                if (error.body && error.body.message) {
                    errorMessage = `❌ Errore: ${error.body.message}`;
                }
    
                this.importMessage = errorMessage;
            });
    }
    
    handleResetDataset() {
        if (!window.confirm('Sei sicuro di voler eliminare il dataset? Questa operazione è irreversibile.')) {
            console.log('❌ Operazione annullata dall\'utente.');
            return;
        }
    
        console.log('🔄 handleResetDataset() chiamato!');
    
        resetAnkerProducts()
            .then(() => {
                console.log('✅ Reset completato con successo!');
                this.importMessage = '✅ Dataset eliminato con successo!';
            })
            .catch(error => {
                console.error('❌ Errore durante il reset:', error);
    
                let errorMessage = '❌ Errore durante il reset dei dati.';
                if (error.body) {
                    errorMessage = `❌ Errore: ${JSON.stringify(error.body)}`;
                }
    
                this.importMessage = errorMessage;
            })
            .finally(() => {
                console.log('🔚 Operazione di reset completata.');
            });
    }
    
    handleResetCategory() {
        if (!window.confirm('Sei sicuro di voler eliminare l\'attuale mappatura delle categorie? Questa operazione è irreversibile.')) {
            console.log('❌ Operazione annullata dall\'utente.');
            return;
        }
        console.log('🔄 handleResetCategory() chiamato!');
    
        resetAnkerCategories()
            .then(() => {
                console.log('✅ Reset categorie completato con successo!');
                this.importMessage = '✅ Categorie eliminate con successo!';
            })
            .catch(error => {
                console.error('❌ Errore durante il reset delle categorie:', error);
    
                let errorMessage = '❌ Errore durante il reset delle categorie.';
                if (error.body) {
                    errorMessage = `❌ Errore: ${JSON.stringify(error.body)}`;
                }
    
                this.importMessage = errorMessage;
            })
            .finally(() => {
                console.log('🔚 Operazione di reset delle categorie completata.');
            });
    }    

    extractCategories() {
        // console.log("🔍 Dati disponibili per l'estrazione categorie:", JSON.stringify(this.data, null, 2));
    
        if (!this.data || this.data.length === 0) {
            console.error("❌ Nessun dato disponibile per estrarre le categorie.");
            return;
        }
    
        //console.log("🔍 Primo record di this.data:", JSON.stringify(this.data[0], null, 2));

        // ✅ Creiamo una copia "pulita" del primo record per evitare problemi con i Proxy
        let firstRow = JSON.parse(JSON.stringify(this.data[0], null, 2));
        console.log("🔍 Primo record di this.data parsed:", firstRow)

        // Stampiamo i nomi delle colonne effettivamente presenti nel file Excel
        let firstRowKeys = Object.keys(firstRow);
        console.log("🔍 Nomi delle colonne disponibili nel file Excel 2:", firstRowKeys);

        // Normalizziamo le chiavi per gestire maiuscole/minuscole e spazi extra
        let normalizedKeys = firstRowKeys.reduce((acc, key) => {
            acc[key.toLowerCase().trim()] = key;
            return acc;
        }, {});
    
        console.log("🔍 Mappatura chiavi normalizzate:", normalizedKeys);

        // Troviamo la colonna che corrisponde a "Main Category" (indipendentemente da maiuscole/minuscole)
        let mainCategoryKey = normalizedKeys["main category"];
    
        if (!mainCategoryKey) {
            console.error("❌ Colonna 'Main Category' non trovata nel file Excel! Verifica il nome esatto.");
            return;
        }
    
        let categorySet = new Set();

        // Estrarre le categorie uniche dal file caricato
        this.data.forEach(product => {
            if (product.hasOwnProperty('Main Category')) {
                if (product['Main Category'] && product['Main Category'].trim() !== '') {
                    categorySet.add(product['Main Category']);
                } else {
                    //console.warn("⚠️ Prodotto senza categoria rilevato, assegnando categoria vuota:", product);
                    categorySet.add(""); // Aggiunge una categoria vuota
                }
            } else {
                console.warn("⚠️ Prodotto senza chiave 'Main Category', assegnando categoria vuota:", product);
                categorySet.add(""); // Aggiunge una categoria vuota
            }
        });
    
        let categoryList = [...categorySet];
    
        // categoryList.forEach((category, index) => {
        //     console.log(`📌 Categoria ${index + 1}: ${category}`);
        // });        

        if (categoryList.length === 0) {
            console.warn("⚠️ Nessuna categoria valida estratta.");
            return;
        }
    
        // Chiamata Apex per salvare le categorie in Salesforce
        importAnkerCategories({ categoryNames: categoryList })
            .then(() => {
                console.log('✅ Categorie salvate correttamente in Salesforce.');
            })
            .catch(error => {
                console.error('❌ Errore nel salvataggio delle categorie:', error);
            });
    }
    
}
