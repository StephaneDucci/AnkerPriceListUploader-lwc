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
        }

        for (Map<String, String> row : productData) {
            try {
                // Filtra i prodotti che non devono essere importati
                if (row.containsKey('Alc %') && (row.get('Alc %') == null || row.get('Alc %').trim() == '' || Decimal.valueOf(row.get('Alc %')) == 0)) {
                    System.debug('⚠️ Prodotto ignorato: Alc % è 0 o vuoto - SKU: ' + row.get('SKU'));
                    continue;
                }
                if (row.containsKey('Main Category') && (row.get('Main Category') == null || row.get('Main Category').trim() == '')) {
                    System.debug('⚠️ Prodotto ignorato: Main Category non definita - SKU: ' + row.get('SKU'));
                    continue;
                }

                Anker_Product__c product = new Anker_Product__c();

                // Mappatura dei campi
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
                
                // Se il Barcode Outercase è più lungo di 14 caratteri, lo lasciamo vuoto
                if (row.containsKey('Barcode Outercase') && row.get('Barcode Outercase') != null && row.get('Barcode Outercase').length() > 14) {
                    System.debug('⚠️ Barcode Outercase troppo lungo, lasciato vuoto - SKU: ' + row.get('SKU'));
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
}
