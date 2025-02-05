public with sharing class AnkerProductImporter {

    @AuraEnabled
    public static List<Anker_Product__c> importAnkerProducts(List<Map<String, String>> productData) {
        List<Anker_Product__c> productsToInsert = new List<Anker_Product__c>();

        System.debug('📊 Numero di record ricevuti: ' + productData.size());

        // Elimina tutti i record esistenti prima dell'import
        try {
            delete [SELECT Id FROM Anker_Product__c];
            System.debug('🗑️ Tutti i record precedenti sono stati eliminati.');
        } catch (DmlException e) {
            System.debug('❌ Errore nell\'eliminazione dei vecchi record: ' + e.getMessage());
            return new List<Anker_Product__c>();
        }

        for (Map<String, String> row : productData) {
            try {
                if (row.containsKey('Alc %') && (row.get('Alc %') == null || row.get('Alc %').trim() == '' || Decimal.valueOf(row.get('Alc %')) == 0)) {
                    continue;
                }
                if (row.containsKey('Main Category') && (row.get('Main Category') == null || row.get('Main Category').trim() == '')) {
                    continue;
                }

                Anker_Product__c product = new Anker_Product__c();
                product.SKU__c = row.get('SKU');
                product.Description__c = row.get('Description');
                product.Case_Size__c = row.containsKey('Case size') && row.get('Case size') != null && row.get('Case size') != '' ? Decimal.valueOf(row.get('Case size')) : null;
                product.Size__c = row.containsKey('Size') && row.get('Size') != null && row.get('Size') != '' ? Decimal.valueOf(row.get('Size')) : null;
                product.Alc__c = row.containsKey('Alc %') && row.get('Alc %') != null && row.get('Alc %') != '' ? Decimal.valueOf(row.get('Alc %')) : null;
                product.Price_Bottle__c = row.containsKey('Price bottle') && row.get('Price bottle') != null && row.get('Price bottle') != '' ? Decimal.valueOf(row.get('Price bottle')) : null;
                product.Comment_Remark__c = row.get('Comment/remark');
                product.Main_Category__c = row.get('Main Category');
                product.Sub_Category__c = row.get('Sub Category');
                product.COO__c = row.get('COO');
                product.Barcode_Bottle__c = row.get('Barcode bottle');
                
                if (row.containsKey('Barcode Outercase') && row.get('Barcode Outercase') != null && row.get('Barcode Outercase').length() > 14) {
                    product.Barcode_Outercase__c = null;
                } else {
                    product.Barcode_Outercase__c = row.get('Barcode Outercase');
                }

                productsToInsert.add(product);
            } catch (Exception e) {
                System.debug('❌ Errore nella creazione del record: ' + e.getMessage());
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
