
var fetch = require('isomorphic-fetch')

var kafka = require('kafka-node'),
   Consumer = kafka.Consumer,
   //TEST
   //client = new kafka.Client("192.168.30.12:2181/kafka", "my-client-id", {
   
   //PROD
   client = new kafka.Client("192.168.0.23:2181/kafka", "my-client-id", {
       sessionTimeout: 300,
       spinDelay: 100,
       retries: 2
   });
   offset = new kafka.Offset(client);
   latestOffset = 0
   offset.fetch([{ topic: 'creationfeed', partition: 0, time: -1 }], function (err, data) {
       latestOffset = data['creationfeed']['0'][0];
       console.log("Consumer current offset: " + latestOffset);
   });
   consumer = new Consumer(
        client,
       [
           { topic: 'creationfeed', partition: 0, offset: 0 }
       ],
       {
           fromOffset: true
       }        
   ); 

const webpush = require('web-push')
const publicVapidKey = 'BI28-LsMRvryKklb9uk84wCwzfyiCYtb8cTrIgkXtP3EYlnwq7jPzOyhda1OdyCd1jqvrJZU06xHSWSxV1eZ_0o';
const privateVapidKey = '_raRRUIefbg4QjqZit7lnqGC5Zh1z6SvQ2p2HGgjobg';
webpush.setVapidDetails('mailto:daf@teamdigitale.it', publicVapidKey, privateVapidKey);

//TEST
//const urlSub = 'http://datipubblici.default.csv.cluster.local:9000/dati-gov/v1/subscribe'
//const urlKylo = 'http://catalog-manager.default.csv.cluster.local:9000/catalog-manager/v1/kylo/feed'
//const urlNotification = 'http://datipubblici.default.csv.cluster.local:9000/dati-gov/v1/notification/save'

//MOCK
//const urlKylo = 'http://localhost:3001/catalog-manager/v1/kylo/feed'

//PROD
const urlSub = 'https://api.daf.teamdigitale.it/dati-gov/v1/subscribe'
const urlKylo = 'https://api.daf.teamdigitale.it/catalog-manager/v1/kylo/feed'
const urlNotification = 'https://api.daf.teamdigitale.it/dati-gov/v1/notification/save'


consumer.on('message', function (message) 
{
   console.log('offset ' + message.offset)
   if(message.offset>=latestOffset){
       console.log('Processo messaggio: ' + message.offset);

        let value = JSON.parse(message.value)
        let responseKylo = createKyloFeed(value);
        responseKylo.then((response) => {
             if(response.ok){  
                console.log('['+message.offset+'] Creazione feed avvenuta con successo')
                var now = new Date()
                var timestamp = now.getDate()+'/'+ (now.getMonth() + 1) +'/'+ now.getFullYear() + ' ' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds()
                const notification = {user: value.user, notificationtype:'kylo_feed', info:{name: value.payload.dcatapit.name, title: value.payload.dcatapit.title}, timestamp: timestamp , status:0, offset: message.offset}

                    let responseNot = addNotification(notification);
                responseNot.then((response) => {
                    if(response.ok){
                        console.log('['+message.offset+'] Notifica inserita con successo ' + JSON.stringify(notification))
                    }else{
                        console.log('['+message.offset+'] Errore nell inserimento della notifica: ' + response.statusText)
                    }
                })  

                let responseSub = getSubscription(value.user);
                responseSub.then((response) => {
                    if(response.ok){
                        response.json().then((subscriptions) => {
                            console.log('sono state trovate ' + subscriptions.length + ' subscription')
                            if(subscriptions.length>0){
                                subscriptions.map((sub) => {
                                    console.log(sub)
                                    try{
                                        webpush.sendNotification(sub, JSON.stringify(notification))
                                        .then(() => console.log('['+message.offset+'] Notifica inviata con successo: ' + JSON.stringify(sub)))
                                        .catch(() => console.log('['+message.offset+'] Errore durante invio della notifica: ' + JSON.stringify(sub)))
                                    }catch(exception){
                                            console.log('['+message.offset+'] Errore durante il push della notifica: ' + JSON.stringify(sub))
                                    }   
                                })
                            }
                        })
                    } else {
                        console.log('Non sono state trovate subscription per l\'utente: ' + value.user)
                    }
                })
             } else {
                console.log('errore creazione feed - message: ' + message.value)
            } 
        });  
    } else {
       console.log('Messaggio con offset ' + message.offset + ' già processato.')
   }
});

consumer.on('error', function (err) 
{
   console.log('Errore nel processare il messaggio '+message.offset+' : ' + err.toString());
});

async function getSubscription(username) {
   const response = await fetch( urlSub + "/" + username , {
       method: 'GET',
       headers: {
           'Accept': 'application/json',
           'Content-Type': 'application/json',
           //'Authorization': 'Basic bmV3X2FuZHJlYUB0ZXN0Lml0OlBhc3N3b3JkMQ==' 
           'Authorization': 'Basic ZF9hbGVAZGFmLml0OlNpbHZpQWxlNzg4MQ=='
       }
   })
   return response;
}

async function createKyloFeed(value) {
   const payload = value.payload
   const fileType = payload.operational.file_type
   const response = await fetch( urlKylo + "/" + fileType , {
       method: 'POST',
       headers: {
           'Accept': 'application/json',
           'Content-Type': 'application/json',
           //'Authorization': 'Basic bmV3X2FuZHJlYUB0ZXN0Lml0OlBhc3N3b3JkMQ==' 
           'Authorization': 'Basic ZF9hbGVAZGFmLml0OlNpbHZpQWxlNzg4MQ=='
       },
       body: JSON.stringify(payload)
   })
   return response;
}

async function addNotification(notification) {
   const response = await fetch( urlNotification , {
       method: 'POST',
       headers: {
           'Accept': 'application/json',
           'Content-Type': 'application/json',
           //'Authorization': 'Basic bmV3X2FuZHJlYUB0ZXN0Lml0OlBhc3N3b3JkMQ==' 
           'Authorization': 'Basic ZF9hbGVAZGFmLml0OlNpbHZpQWxlNzg4MQ=='
       },
       body: JSON.stringify(notification)
   })
   return response;
}