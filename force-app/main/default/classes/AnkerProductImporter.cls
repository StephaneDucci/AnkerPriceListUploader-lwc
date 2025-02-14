public with sharing class AnkerProductImporter {


    @AuraEnabled
    public static List<Product2> importAnkerProducts(List<Map<String, String>> productData) {
    
        // Le liste che conterranno i prodotti da inserire e quelli da aggiornare
        List<Product2> productsToInsert = new List<Product2>();
        List<Product2> productsToUpdate = new List<Product2>();
        
        // Mappature
        Map<String, String> categoryMapping = new Map<String, String>();  // Mappa categorie
        Map<String, Product2> existingProductsMap = new Map<String, Product2>();  // Mappa prodotti esistenti
        Set<String> importedSKUs = new Set<String>();  // Set con gli SKU importati
    
        System.debug('📊 Numero di record ricevuti: ' + productData.size());
        
        // Recupera il Record Type ID corretto
        Id importedMaltRTId = [SELECT Id FROM RecordType WHERE DeveloperName = 'Imported_Malt' AND SObjectType = 'Product2' LIMIT 1].Id;

        // Ora usa l'ID corretto nella query sui prodotti
        List<Product2> existingProducts = [SELECT Id, Anker_SKU__c, Name, Price__c, IsActive FROM Product2 WHERE RecordTypeId = :importedMaltRTId];
        System.debug('Prodotti Anker presenti in product2 - ' + existingProducts.size());
        
        // Popoliamo la mappa dei prodotti esistenti
        for (Product2 prod : existingProducts) {
            existingProductsMap.put(prod.Anker_SKU__c, prod);
        }
    
        // Recuperiamo la mappatura delle categorie
        for (Anker_Category__c category : [SELECT Name, Coppo_Category__c FROM Anker_Category__c]) {
            categoryMapping.put(category.Name, category.Coppo_Category__c);
        }
    
        // Iteriamo sui prodotti importati
        for (Map<String, String> row : productData) {
            try {
                // Controlliamo se la categoria del fornitore esiste nella mappatura
                String supplierCategory = row.get('Main Category');
                if (String.isBlank(supplierCategory) || !categoryMapping.containsKey(supplierCategory)) {
                    System.debug('❌ Record scartato: Categoria non riconosciuta - ' + supplierCategory);
                    continue;
                }
    
                // Recuperiamo la categoria mappata
                String mappedCategory = categoryMapping.get(supplierCategory);
                if (String.isBlank(mappedCategory) || mappedCategory == 'NOT TO IMPORT') {
                    System.debug('❌ Record scartato: Categoria non trattata - ' + supplierCategory);
                    continue;
                }

                // Filtriamo i record che hanno Size >= 0.5 e Price bottle < 5€
                Decimal size = row.containsKey('Size') && row.get('Size') != null ? Decimal.valueOf(row.get('Size')) : null;
                Decimal priceBottle = row.containsKey('Price bottle') && row.get('Price bottle') != null ? Decimal.valueOf(row.get('Price bottle')) : null;
                if (size != null && priceBottle != null && size >= 0.5 && priceBottle < 5) {
                    System.debug('❌ Record scartato, prodotto di valore troppo basso - ' + row.get('Description'));
                    continue;
                }

                // Popoliamo il set degli SKU importati
                String sku = row.get('SKU');
                importedSKUs.add(sku);

                if (existingProductsMap.containsKey(sku)) { 
                    // Il prodotto esiste già → aggiornamento
                    Product2 existingProduct = existingProductsMap.get(sku);
                    existingProduct.isActive = true;
                    existingProduct.Price__c = priceBottle;

                    productsToUpdate.add(existingProduct);
                } else {
                    // Creiamo un nuovo prodotto
                    Product2 newProduct = new Product2();
                    newProduct.Anker_SKU__c = sku;
                    newProduct.Name = row.get('Description');
                    newProduct.Category__c = mappedCategory;
                    newProduct.isActive = true;
                    try {
                        newProduct.Case_Size__c = (row.containsKey('Case size') ? Decimal.valueOf(row.get('Case size')) : null);
                    } catch (Exception e) {
                        System.debug('❌ ERRORE conversione "Case Size": ' + e.getMessage() + ' - Valore originale: "' + row.get('Case size') + '"');
                    }
                    try {
                        newProduct.Vol__c = (row.containsKey('Alc %') ? Decimal.valueof(row.get('Alc %')) : null);
                    } catch (Exception e) {
                        System.debug('❌ ERRORE conversione "Alc %": ' + e.getMessage() + ' - Valore originale: "' + row.get('Alc %') + '"');
                    }
                    newProduct.Size__c = size;
                    newProduct.Price__c = priceBottle;
                    newProduct.Barcode__c = row.get('Barcode bottle');
                    newProduct.RecordTypeId = importedMaltRTId;

                    productsToInsert.add(newProduct);
                }
            } catch (Exception e) {
                System.debug('❌ Errore nella creazione del record: ' + e.getMessage() + ' - ' + row.get('SKU'));
            }
        }

        // Disattivo i prodotti non presenti nel listino ma già registrati in Product2
        for (Product2 existingProduct : existingProducts) {
            if (!importedSKUs.contains(existingProduct.Anker_SKU__c)) {
                existingProduct.IsActive = false;
                productsToUpdate.add(existingProduct);
            }
        }

        // **Effettuiamo gli aggiornamenti e gli inserimenti in batch**
        if (!productsToUpdate.isEmpty()) {
            try {
                System.debug('📊 Tentativo di aggiornamento di ' + productsToUpdate.size() + ' prodotti.');
                update productsToUpdate;
                System.debug('✅ ' + productsToUpdate.size() + ' prodotti aggiornati con successo!');
            } catch (DmlException e) {
                System.debug('❌ Errore nell\'aggiornamento dei record: ' + e.getMessage());
            }
        }

        if (!productsToInsert.isEmpty()) {
            try {
                System.debug('📊 Tentativo di inserimento di ' + productsToInsert.size() + ' prodotti.');
                insert productsToInsert;
                System.debug('✅ ' + productsToInsert.size() + ' prodotti inseriti con successo!');
            } catch (DmlException e) {
                System.debug('❌ Errore nell\'inserimento dei record: ' + e.getMessage());
            }
        }
    
        return productsToInsert;
    }

    @AuraEnabled
    public static void resetAnkerProducts() {
        try {
            System.debug('🔄 Tentativo di eliminazione di tutti i record Anker_Product__c...');
            Integer recordsDeleted = [SELECT COUNT() FROM Anker_Product__c];
    
            if (recordsDeleted > 0) {
                delete [SELECT Id FROM Anker_Product__c];
                System.debug('✅ Eliminati ' + recordsDeleted + ' record.');
            } else {
                System.debug('⚠️ Nessun record da eliminare.');
            }
        } catch (DmlException e) {
            System.debug('❌ Errore durante la cancellazione dei record: ' + e.getMessage());
            throw new AuraHandledException('Errore durante la cancellazione: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void importAnkerCategories(List<String> categoryNames) {
        if (categoryNames == null || categoryNames.isEmpty()) {
            throw new AuraHandledException('Nessuna categoria fornita per l\'import.');
        }
    
        Set<String> existingCategories = new Set<String>();
    
        // Recupera tutte le categorie esistenti e le normalizza in lowercase+trim
        for (Anker_Category__c cat : [SELECT Name FROM Anker_Category__c]) {
            existingCategories.add(cat.Name.trim().toLowerCase());
        }
    
        List<Anker_Category__c> categoriesToInsert = new List<Anker_Category__c>();
    
        for (String categoryName : categoryNames) {
            if (String.isBlank(categoryName)) {
                continue; // Evita nomi vuoti o null
            }
            String cleanCategoryName = categoryName.trim().toLowerCase();
            
            // Se la categoria esiste già, la ignoriamo
            if (existingCategories.contains(cleanCategoryName)) {
                System.debug('ℹ️ Categoria già esistente: ' + categoryName);
                continue;
            }
    
            // Creiamo la nuova categoria
            Anker_Category__c newCategory = new Anker_Category__c();
            newCategory.Name = categoryName.trim(); // Mantiene la formattazione originale per la UI
            categoriesToInsert.add(newCategory);
    
            // Aggiorniamo l'insieme per evitare duplicati nello stesso batch
            existingCategories.add(cleanCategoryName);
        }
    
        if (!categoriesToInsert.isEmpty()) {
            try {
                Database.insert(categoriesToInsert, false); // `false` permette di ignorare gli errori su singole righe
                System.debug('✅ ' + categoriesToInsert.size() + ' nuove categorie inserite.');
            } catch (DmlException e) {
                System.debug('❌ Errore durante l\'inserimento: ' + e.getMessage());
                throw new AuraHandledException('Errore durante l\'inserimento: ' + e.getMessage());
            }
        } else {
            System.debug('⚠️ Nessuna nuova categoria da inserire.');
        }
    }

    @AuraEnabled
    public static void resetAnkerCategories() {
        try {
            System.debug('🔄 Tentativo di eliminazione di tutti i record Anker_Category__c...');
            Integer recordsDeleted = [SELECT COUNT() FROM Anker_Category__c];
    
            if (recordsDeleted > 0) {
                delete [SELECT Id FROM Anker_Category__c];
                System.debug('✅ Eliminati ' + recordsDeleted + ' record.');
            } else {
                System.debug('⚠️ Nessun record da eliminare.');
            }
        } catch (DmlException e) {
            System.debug('❌ Errore durante la cancellazione dei record: ' + e.getMessage());
            throw new AuraHandledException('Errore durante la cancellazione: ' + e.getMessage());
        }
    }
}
