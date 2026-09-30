const PRODUCTS={layered:{name:'Layered Color Art',prices:{small:49,medium:69,large:89},lighting:false},classicLitho:{name:'Classic Lithophane',prices:{small:79,medium:99,large:129},lighting:true},colorLitho:{name:'Color Lithophane',prices:{small:99,medium:129,large:159},lighting:true},lightbox:{name:'LED Lightbox',prices:{small:89,medium:119,large:149},lighting:true},matrix32:{name:'32 × 16 Larger LED Matrix',price:199,lighting:true,matrix:true},matrix44:{name:'44 × 11 Wide LED Matrix',price:219,lighting:true,matrix:true}};
const LIGHT={white:0,rgb:40,custom:80};
const MATRIX={standard:0,app:40,custom:100};

const NFC_TIERS={keyChain:{name:'Tap Stand — Key Chain',price:30},singleTap:{name:'Tap Stand — Single Tap',price:50},doubleTap:{name:'Tap Stand — Double Tap',price:75}};
async function handleTapMini(c,res){
 const qty=Math.max(1,Math.min(100,Number(c.quantity)||1));
 const custom=c.style==='custom';
 const each=qty>=2?20:25;
 const design=custom?(qty>=5?0:15):0;
 const total=each*qty+design;
 if(c.url&&!/^https?:\/\/.+/i.test(String(c.url)))throw new Error('Enter a link beginning with http:// or https://');
 const parts=[`${qty} × Tap Mini${custom?' (custom design)':''}`,c.url?`Destination: ${String(c.url).slice(0,200)}`:'Link to be provided later',custom?'Logo/colors follow-up before production':'',c.notes?`Notes: ${String(c.notes).slice(0,160)}`:''].filter(Boolean);
 const url=await createSquareLink(parts,total);
 return res.status(200).json({url});
}

const NFC_COLORS=new Set(['Black','White','Gray','Navy','Forest Green','Rose','Cream','Gold','Bronze']);

async function createSquareLink(parts,total){
 const response=await fetch('https://connect.squareup.com/v2/online-checkout/payment-links',{method:'POST',headers:{'Square-Version':'2026-08-19','Authorization':`Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:crypto.randomUUID(),quick_pay:{name:parts.join(' • ').slice(0,255),price_money:{amount:total*100,currency:'USD'},location_id:process.env.SQUARE_LOCATION_ID},payment_note:parts.join(' | ').slice(0,500),checkout_options:process.env.SITE_URL?{redirect_url:`${process.env.SITE_URL.replace(/\/$/,'')}/thanks.html`}:undefined})});
 const data=await response.json();
 if(!response.ok)throw new Error(data.errors?.[0]?.detail||'Square checkout could not be created');
 return data.payment_link.url;
}

async function handleNfcStand(c,res){
 const tier=NFC_TIERS[c.tier];
 if(!tier)throw new Error('Invalid NFC Tap Stand tier');
 const qty=Math.max(1,Math.min(10,Number(c.quantity)||1));
 if(!c.url||!/^https?:\/\/.+/i.test(String(c.url)))throw new Error('A valid destination URL beginning with http:// or https:// is required');
 const standColor=NFC_COLORS.has(c.standColor)?c.standColor:null;
 const baseColor=NFC_COLORS.has(c.baseColor)?c.baseColor:null;
 const accentColor=NFC_COLORS.has(c.accentColor)?c.accentColor:null;
 if(!standColor||!baseColor||!accentColor)throw new Error('Invalid color selection');
 const total=tier.price*qty;
 const parts=[`${qty} × ${tier.name}`,`Stand: ${standColor}`,`Base: ${baseColor}`,`Accent: ${accentColor}`,`Destination: ${String(c.url).slice(0,200)}`,c.logo?'Logo/artwork requested — follow-up needed before production':'',c.notes?`Notes: ${String(c.notes).slice(0,160)}`:''].filter(Boolean);
 const url=await createSquareLink(parts,total);
 return res.status(200).json({url});
}

module.exports=async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(!process.env.SQUARE_ACCESS_TOKEN||!process.env.SQUARE_LOCATION_ID)return res.status(503).json({error:'Square checkout is awaiting activation.'});
 try{
  const c=req.body||{};
  // Everything except the single-tap stand is quoted per job.
  if(c.kind==='nfcStand'&&c.tier==='singleTap')return await handleNfcStand(c,res);
  throw new Error('This item is quoted per job. Please request a quote.');
  const p=PRODUCTS[c.product];
  if(!p||c.oversized)throw new Error('Invalid standard configuration');
  const qty=Math.max(1,Math.min(10,Number(c.quantity)||1));
  const base=p.matrix?p.price:p.prices[c.size];
  if(!base)throw new Error('Invalid size');
  const lighting=p.lighting?(p.matrix?MATRIX[c.lighting]:LIGHT[c.lighting]):0;
  if(lighting===undefined)throw new Error('Invalid lighting');
  const nfc=c.nfc?20:0;
  const connected=c.connected?(p.matrix?75:(c.lighting==='custom'?50:30)):0;
  const total=(base+lighting+nfc)*qty+connected;
  const parts=[`${qty} × ${p.name}`,p.matrix?'':`${c.size} ${c.orientation||''}`.trim(),c.mount||'',c.lighting||'',c.nfc?`NFC: ${c.nfcDestination||'Tap Experience'}${c.nfcUrl?' '+c.nfcUrl:''}`:'',c.connected?'Connected Set':'',c.notes?`Notes: ${String(c.notes).slice(0,160)}`:''].filter(Boolean);
  const url=await createSquareLink(parts,total);
  return res.status(200).json({url});
 }catch(error){return res.status(400).json({error:error.message||'Checkout could not be created'});}
};
