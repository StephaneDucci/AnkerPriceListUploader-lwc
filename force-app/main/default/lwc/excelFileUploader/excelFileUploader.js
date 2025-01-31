import { LightningElement } from 'lwc';
import sheetJS from '@salesforce/resourceUrl/SheetJS';
import { loadScript } from 'lightning/platformResourceLoader';

export default class ExcelFileUploader extends LightningElement {
    fileName = 'Nessun file selezionato';
    data = [];
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
            console.log(`📄 Foglio selezionato: ${sheetName}`);
            const sheet = workbook.Sheets[sheetName];

            let jsonData;
            try {
                jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }); // Legge con valori di default per celle vuote
                console.log('📊 Dati grezzi (prima della pulizia):', JSON.stringify(jsonData, null, 2));
            } catch (error) {
                console.error('❌ Errore nella conversione in JSON:', error);
                return;
            }

            if (!jsonData || jsonData.length === 0) {
                console.error('❌ Il file sembra vuoto.');
                return;
            }

            console.log(`📊 Numero di righe prima della rimozione delle prime 11: ${jsonData.length}`);
            jsonData = jsonData.slice(11); // Rimuove le prime 11 righe
            console.log(`📊 Numero di righe dopo la rimozione: ${jsonData.length}`);

            jsonData = jsonData.slice(0, 100); // Limita a 100 righe per test
            console.log('📊 Dati dopo la rimozione delle prime 11 righe:', JSON.stringify(jsonData, null, 2));

            if (!jsonData[0]) {
                console.error('❌ Nessuna intestazione trovata.');
                return;
            }

            console.log('🛠️ Intestazioni originali:', jsonData[0]);

            // Rimuove le colonne B e C (indice 1 e 2)
            //jsonData = jsonData.map(row => row.filter((_, index) => index !== 1 && index !== 2));
            //console.log('📊 Dati dopo la rimozione delle colonne B e C:', JSON.stringify(jsonData, null, 2));

            // Definizione della mappa delle colonne
            const fieldMapping = {
                'sku': 'SKU',
                'description': 'Description',
                'case size': 'Case size',
                'size': 'Size',
                'alc %': 'Alc %',
                'price bottle': 'Price bottle',
                'comment/remark': 'Comment/remark',
                'main category': 'Main Category',
                'sub category': 'Sub category',
                'coo': 'COO',
                'barcode bottle': 'Barcode bottle',
                'barcode outercase': 'Barcode Outercase'
            };

            // Processa le intestazioni
            const headers = jsonData[0].map(h => h ? h.toLowerCase().trim() : '');
            console.log('🛠️ Intestazioni processate:', headers);

            const mappedIndices = {};
            headers.forEach((h, index) => {
                if (fieldMapping[h]) {
                    mappedIndices[fieldMapping[h]] = index;
                }
            });

            console.log('🔎 Indici mappati:', mappedIndices);

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
            console.log('✅ Dati elaborati (finali):', JSON.stringify(this.data, null, 2));
        };

        reader.readAsBinaryString(file);
    }
}
