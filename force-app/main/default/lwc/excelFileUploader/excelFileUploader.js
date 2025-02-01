// Import standard di LWC
import { LightningElement, wire, track } from 'lwc';

// Import delle risorse statiche
import sheetJS from '@salesforce/resourceUrl/SheetJS';
import { loadScript } from 'lightning/platformResourceLoader';

// Import dei metodi Apex
import importAnkerProducts from '@salesforce/apex/AnkerProductImporter.importAnkerProducts';
import resetAnkerProducts from '@salesforce/apex/AnkerProductImporter.resetAnkerProducts';

export default class ExcelFileUploader extends LightningElement {
    fileName = 'Nessun file selezionato';
    data = [];
    sheetJsInitialized = false;
    importMessage = '';

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

    handleFileChange(event) {
        const file = event.target.files[0];
        if (file) {
            this.fileName = file.name;
            console.log(`📂 File selezionato: ${this.fileName}`);
            this.readExcelFile(file);
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

            jsonData = jsonData.slice(11); // Rimuove le prime 11 righe
            jsonData = jsonData.slice(0,500); // Limita l'import a 500 record

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
        };

        reader.readAsBinaryString(file);
    }
    
    handleImport() {
        console.log('🔄 handleImport() chiamato!');
        console.log('📊 Dati inviati ad Apex:', JSON.stringify(this.data, null, 2));
    
        if (!this.data || this.data.length === 0) {
            console.error('❌ Nessun dato disponibile per l\'importazione.');
            this.importMessage = '❌ Nessun dato da importare. Carica un file valido.';
            return;
        }
    
        importAnkerProducts({ productData: this.data })
            .then(result => {
                console.log('📩 Risultato ricevuto da Apex:', result);
    
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
    
}
