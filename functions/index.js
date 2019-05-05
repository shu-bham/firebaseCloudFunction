const functions = require('firebase-functions');

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions
const admin = require('firebase-admin');
admin.initializeApp();

exports.onInventoryChange = functions.database.ref('/CompanyDatabase/Inventory/{inventoryId}')
.onUpdate((snapshot, context) => {
  // const snap_before = snapshot.before().val();
  const snap_after = snapshot.after.val();
  const inventoryId = context.params.inventoryId;
  if(snap_after.Stock < snap_after.Min_Stock){
    console.log("Alerting All technicians");
    // const title = snap_after.InvID;
    const StockDeficiency = snap_after.Min_Stock - snap_after.Stock;
    const payload = {
      notification : {
        title : "Inventory Id: " + inventoryId,
        body : "Stock is below Minm Reqd Level"
      },
      data : {
        title : "Insufficient Stock",
        body : JSON.stringify({
          inventoryId : inventoryId,
          StockDeficiency : String(StockDeficiency)
        })
      }
    };
  
    sendPayloadToAllTechnicians(payload).then(res => {
      console.log("Msg sent Successfully :",res);
      return null
    }).catch(err => {
      console.log("Sending Failed :",err)
    })
  }
  return null;
})

async function sendPayloadToAllTechnicians(payload){
  const tokens = [];
  const prom = await admin.database().ref('/CompanyDatabase/EmployeeDetails')
    .once('value', snapshot => {
        snapshot.forEach(child => {
          // console.log(child.key,child.val())
          tokens.push(child.val().Token);
        })
  })
  // console.log("tokens :" ,tokens);
  // const t = admin.database().ref('/CompanyDatabase/EmployeeDetails').on()
  return admin.messaging().sendToDevice(tokens,payload);
}


exports.onTempCreate = functions.database.ref('/sensor/temp/{bId}/{pId}')
.onWrite((snapshot, context) => {
  
  const threshold = 85;
  const boilerId = context.params.bId;
  const temp_val = snapshot.after.val().val; 
  console.log('current temp:',temp_val, boilerId);
  if(temp_val >= threshold){
      
    const date = new Date();
    var time = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
    const body = "Boiler Id : " + boilerId + " Time:" +  time
    const data_body = {
        boilerId : boilerId,
        message : "Boiler Temp is High",
        date : date.toISOString()
    }
    const payload = {
        notification : {
          title : 'Temp High',
          body : body
        },
        data : {
          title : 'Temp ',
          body: JSON.stringify(data_body)
        }
      }
    sendPayload(boilerId, payload).then(res => {
      console.log("Msg sent successfully :  " , res)
      return null;
    }).catch(err => {
      console.log("Sending failed : ", err);
    })
  }
  return null;
});

async function getDeviceTokens(boilerId) {
  const personIdProm = await admin.database().ref(`/CompanyDatabase/BoilerDetails`).once('value');
  // console.log(personIdProm.val());
  const personId = personIdProm.child(`${boilerId}`).val().Technician
  // console.log("personId", personId);
  const snap = await admin.database().ref(`/CompanyDatabase/EmployeeDetails`).once('value');
  if (snap.hasChild(personId)) {
    console.log("PersonId:",personId,"Token",snap.child(personId).val().Token)
    return snap.child(personId).val().Token;
  }
  return [];
}

async function sendPayload(boilerId, payload){
  const token = await getDeviceTokens(boilerId);
  if(token.length > 0){
    console.log("Sending to Device", payload, token);
    return admin.messaging().sendToDevice(token, payload);
    // return result;
  }
  return null;
}

// Take the text parameter passed to this HTTP endpoint and insert it into the
// Realtime Database under the path /messages/:pushId/original
// exports.addMessage = functions.https.onRequest(async (req, res) => {
//     // Grab the text parameter.
//     const original = req.query.text;
//     // Push the new message into the Realtime Database using the Firebase Admin SDK.
//     const snapshot = await admin.database().ref('/messages').push({original: original});
//     // Redirect with 303 SEE OTHER to the URL of the pushed object in the Firebase console.
//     res.redirect(303, snapshot.ref.toString());
//   });

// // Listens for new messages added to /messages/:pushId/original and creates an
// // uppercase version of the message to /messages/:pushId/uppercase
// exports.makeUppercase = functions.database.ref('/messages/{pushId}/original')
// .onCreate((snapshot, context) => {
//   // Grab the current value of what was written to the Realtime Database.
//   const original = snapshot.val();
//   console.log('Uppercasing', context.params.pushId, original);
//   const uppercase = original.toUpperCase();
//   // You must return a Promise when performing asynchronous tasks inside a Functions such as
//   // writing to the Firebase Realtime Database.
//   // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
//   return snapshot.ref.parent.child('uppercase').set(uppercase);
// });
