/*
	Animal Crossing: New Leaf Save Editor v20151012
	by Marc Robledo 2015
*/

var AUTO_INCREMENT=false; /* automatic increase item index after placing */

const VERSION=20151012;
const PATTERN_SIZE=2160;

function el(e){return document.getElementById(e)}
function show(e){el(e).style.display='block'}
function hide(e){el(e).style.display='none'}
function toggle(e){if(el(e).style.display=='block')hide(e);else show(e)}
function addEvent(e,ev,f){if(e.addEventListener){e.addEventListener(ev,f,false);return true}else if(e.attachEvent)e.attachEvent('on'+ev,f)}
function prevent(evt){evt.stopPropagation();evt.preventDefault()}
function setCookie(k,v){document.cookie='acnleditor'+k+'='+v+'; expires=Thu, 31 Dec 2020 12:00:00 UTC'}
function getCookie(k){var cs=document.cookie.split(';');for(var i=0;i<cs.length;i++){var f=cs[i].indexOf(k+'=');if(f>-1)return cs[i].substring(f+(k+'=').length)}return false}
function getXMLLang(e){if(e.attributes.getNamedItem(el('lang-selector').value))return e.attributes.getNamedItem(el('lang-selector').value).value;else return e.attributes.getNamedItem('en').value}
function getXMLId(e){return hexToInt(e.attributes.getNamedItem('id').value)}
function getXMLBoolean(x,a){return(x.attributes.getNamedItem(a))?true:false}
function getXMLAttribute(x,a){if(x.attributes.getNamedItem(a))return x.attributes.getNamedItem(a).value;else return false}
function openDialog(d){show('overlay');show(d+'-dialog');el(d+'-dialog').style.marginTop='-'+parseInt(el(d+'-dialog').offsetHeight/2)+'px';el(d+'-dialog').style.marginLeft='-'+parseInt(el(d+'-dialog').offsetWidth/2)+'px'}
function closeDialog(){hide('overlay');hide('update-dialog');hide('pattern-dialog');hide('building-dialog');hide('villager-dialog')}
function hexToInt(i){return parseInt(i,16)}
function intToHex(i,b){var h=i.toString(16);while(h.length<b*2)h='0'+h;return h}
function byteToBin(i){var b=i.toString(2);while(b.length<8)b='0'+b;return b}
function binToByte(b){return parseInt(b,2)}
function editLatest2Bits(i,b){var bin=byteToBin(i).split('');bin[6]=b.charAt(0);bin[7]=b.charAt(1);return binToByte(bin.join(''))}

function UString(offset, maxLength){
	this.offset=offset;
	this.maxLength=maxLength;

	this.chars=new Array(maxLength);
	for(var i=0; i<maxLength; i++)
		this.chars[i]=savegame.readByte2(offset+i*2);

}
UString.prototype.set=function(s){
	for(var i=0; i<this.maxLength; i++)
		this.chars[i]=0;
	for(var i=0; i<s.length && i<this.maxLength-1; i++)
		this.chars[i]=s.charCodeAt(i);
}
UString.prototype.save=function(){
	this.saveAt(this.offset);
}
UString.prototype.saveAt=function(offset){
	for(var i=0; i<this.maxLength; i++)
		savegame.storeByte2(offset+i*2, this.chars[i]);
}
UString.prototype.toString=function(){
	var string='';
	for(var i=0; i<this.maxLength && this.chars[i]!=0; i++)
		string+=String.fromCharCode(this.chars[i]);
	/*if(chars[i]>0x00ff)
		string+='[0x'+intToHex(chars[i], 2)+']'
	}*/

	return string
}


const TABS=['map','acres','players','island','villagers','buildings','advanced'];
const PLAYER_BLOCKS=['gender','tan','face','pockets','dressers','islandbox','badges','patterns','other'];

function showTab(newTab){
	for(var i=0; i<TABS.length; i++){
		if(newTab==TABS[i]){
			show('tab-'+newTab);
			el('tab-button-'+newTab).className='active'
		}else{
			hide('tab-'+TABS[i]);
			el('tab-button-'+TABS[i]).className=''
		}
	}

	if(newTab=='map' || newTab=='players' || newTab=='island' || newTab=='buildings')
		show('itemsribbon');
	else
		hide('itemsribbon')
}
function updateLangIcon(l){el('lang-flag').className='sprite flag flag-'+l}



var xmlData=0;
var mouseHeld=0, tempFile, tempFileLoadFunction;
var savegame, itemSlots, players, acres, buildings, town;


/* Initialize ACNL editor */
addEvent(window,'load',function(){
	var cookieLang=getCookie('lang');
	if(cookieLang){
		el('lang-selector').value=cookieLang;
		updateLangIcon(cookieLang);
	}

	var cookieVersion=getCookie('version');
	if(!cookieVersion || cookieVersion!=VERSION){
		openDialog('update');
		setCookie('version', VERSION);
	}

	/* AJAX */
	if(!window.XMLHttpRequest){
		quickAlert('Your browser is not compatible with AJAX functions.');
		return false;
	}

	var req=new XMLHttpRequest();
	req.open('POST', 'http://acnleditor.github.io/mark/acnl_editor/acnl_items.xml', true);
	//req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
	req.onreadystatechange=function(){
		if (req.readyState == 4){
			if(req.status==200 || req.status==0){
				xmlData=req.responseXML;
				hide('loading');
				show('loadform');
			}else{
				el('loading').innerHTML='Error: I can\'t load item list (status:'+req.status+')'
			}
		}
	}
	req.send();
});






function Town(){
	this.treeSize=savegame.readByte1(0x049516); //01-07
	this.grassType=savegame.readByte1(0x04da01);
	this.playTime=savegame.readByte2(0x5c730);
	this.playTimeSeconds=this.playTime%60;
	this.playTimeMinutes=(this.playTime/60)%60;
	this.playTimeHours=(this.playTime/60*60)%24;
	this.playTimeDays=(this.playTime/60*60*24)%25000;
	this.daysPlayed=savegame.readByte2(0x5c7ba);
	this.townId1=savegame.readByte1(0x05c738);
	this.townId2=savegame.readByte1(0x05c738+1);
	this.townName=new UString(0x5c73a, 10);

	this.nativeFruit=savegame.readByte1(0x05c7b6);


	/* search all town ID references */
	var townId=new Array(5); // 5*4=20 bytes
	for(var i=0; i<5; i++){
		townId[i]=savegame.readByte4(0x05c738+i*4);
	}

	this.townIdReferences=new Array();
	for(var offset=0; offset<522624-5*4; offset+=2){
		var found=true;
		for(var i=0; i<5 && found; i++){
			if(savegame.readByte4(offset+i*4)!=townId[i]){
				found=false;
			}
		}
		if(found){
			this.townIdReferences.push(offset);
			offset+=5*4;
		}
	}

	this.pastVillagers=new Array(16);
	for(var i=0; i<16; i++){
		this.pastVillagers[i]=new PastVillager(i);
	}
}
Town.prototype.save=function(){
	savegame.storeByte(0x05c7b6, this.nativeFruit);
	savegame.storeByte(0x04da01, this.grassType);

	/* fix town ID references */
	for(var i=0; i<this.townIdReferences.length; i++){
		savegame.storeByte(this.townIdReferences[i], this.townId1);
		savegame.storeByte(this.townIdReferences[i]+1, this.townId2);
	}

	for(var i=0; i<16; i++){
		this.pastVillagers[i].save();
	}
}


function generateTownHallColorIds(townId1){
	var arr=new Array(4);
	arr[0]=editLatest2Bits(townId1, '00');
	arr[1]=editLatest2Bits(townId1, '01');
	arr[2]=editLatest2Bits(townId1, '10');
	arr[3]=editLatest2Bits(townId1, '11');
	return arr;
}
function generateTrainStationColorIds(townId2){
	var arr=new Array(4);
	arr[0]=editLatest2Bits(townId2, '00');
	arr[1]=editLatest2Bits(townId2, '01');
	arr[2]=editLatest2Bits(townId2, '10');
	arr[3]=editLatest2Bits(townId2, '11');
	return arr;
}
Town.prototype.unlockAllPWPs=function(){
	var ALL_PWPS=[
		0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
		0xff,0xff,0xff,0xff,0x2a,0xd6,0xe4,0x58
	];

	for(var i=0; i<ALL_PWPS.length; i++)
		savegame.storeByte(0x04d9c8+i, ALL_PWPS[i])
}
//const ADDRESS_CURRENT_GRASS=0x052a58;
Town.prototype.setGrass=function(b){
	var MAX=((16*16)*(5*4))*2;
	for(var i=0; i<MAX; i++)
		savegame.storeByte(0x053e80+i, b)
}
Town.prototype.fillGrass=function(){if(confirm('Do you want to revive all grass?'))this.setGrass(0xff)}
Town.prototype.fillDesert=function(){if(confirm('Do you want to kill all grass?'))this.setGrass(0x00)}
Town.prototype.fillStrippedGrass=function(){
	if(confirm('Do you want to strip all grass?')){
		var MAX=((16*16)*(5*4))*2;
		for(var i=0; i<MAX; i++){
			var b;
			if(i%2==0){
				b=0x00;
			}else{
				b=0xff;
			}
			savegame.storeByte(0x053e80+i, b)
		}
	}
}






function Acre(map, n){
	if(map==='map')
		this.offset=0x04da04;
	else if(map==='island')
		this.offset=0x06a408;
	this.offset+=n*2;
	this.map=map;
	this.n=n;

	this.id=savegame.readByte1(this.offset);

	if(
		(map==='map' && ((n>=7 && n<=13) || (n>=14 && n<=20) || (n>=21 && n<=27) || (n>=28 && n<=34))) ||
		(map==='island' && ((n>=5 && n<=6) || (n>=9 && n<=10)))
	){
		this.button=document.createElement('input');
		this.button.type='image';
		this.button.className='button';
		this.button.acre=this;
		this.button.id='mapacre'+n;
		if(map==='map')
			el('map-acres').appendChild(this.button);
		else if(map==='island')
			el('island-acres').appendChild(this.button);
		this.refreshThumbnail();

		if(this.id!=156 && this.id!=165)
			addAcreEvents(this);

		acres.push(this);
	}


}
Acre.prototype.save=function(){
	savegame.storeByte2(this.offset, this.id);
}
Acre.prototype.refreshThumbnail=function(a){
	var image='./acres/'+this.id+'.png';

	this.button.src=image;
	this.button.title=this.id;

	var acreX, acreY, acreDiv;
	if(this.map==='map'){
		acreX=this.n%7;
		acreY=parseInt(this.n/7);
		acreDiv='acre'+acreX+'_'+acreY;

	}else if(this.map==='island'){
		acreX=this.n%4;
		acreY=parseInt(this.n/4);
		acreDiv='acreisland'+acreX+'_'+acreY;
	}
	if(el(acreDiv))
		el(acreDiv).style.backgroundImage='url('+image+')';
}
function addAcreEvents(a){
	addEvent(a.button, 'mousedown', function(evt){clickAcre(evt, a)});
}
function clickAcre(evt, acre){
	var newVal=acre.id;

	if(newVal>=0 && newVal<=153){
		if(evt.which==1){
			newVal++;
		}else if(evt.which==3){
			newVal--;
		}

		if(newVal==-1){
			newVal=153;
		}else if(newVal==154){
			newVal=0;
		}
	}else if(newVal>=180 && newVal<=203){
		if(evt.which==1){
			newVal++;
		}else if(evt.which==3){
			newVal--;
		}

		if(newVal==179){
			newVal=203;
		}else if(newVal==204){
			newVal=180;
		}
	}else if(newVal==154){
		newVal=155;
	}else if(newVal==155){
		newVal=154;
	}else if(newVal==163){
		newVal=164;
	}else if(newVal==164){
		newVal=163;
	}

	acre.id=newVal;
	acre.refreshThumbnail();
}




function Pattern(offset){
	this.offset=offset;

	this.canvas=document.createElement('canvas');
	this.canvas.width=32;
	this.canvas.height=32;
	this.canvas.className='pattern';
	this.pattern=this;
	this.refreshCanvas();
	addPatternEvents(this);
}
Pattern.prototype.refreshCanvas=function(){
	var ctx=this.canvas.getContext('2d');
	var palette=new Array(15);
	for(var i=0; i<palette.length; i++)
		palette[i]=savegame.readByte1(this.offset+0x58+i);

	for(var y=0; y<32; y++){
		for(var x=0; x<16; x++){
			var bothColors=savegame.readByte1(this.offset+0x6c+y*16+x);

			var rightColor=parseInt(bothColors/16);
			var leftColor=bothColors%16;

			ctx.fillStyle=patternColor(palette[leftColor]);
			ctx.fillRect(x*2, y, 1, 1);
			
			ctx.fillStyle=patternColor(palette[rightColor]);
			ctx.fillRect(x*2+1, y, 1, 1);
		}
	}

	this.title=new UString(this.offset, 20).toString();
	this.author=new UString(this.offset+0x2c, 10).toString();
	this.canvas.title=this.title+' by '+this.author;
}
Pattern.prototype.importFromTempFile=function(){
	for(var i=0; i<tempFile.fileSize && i<PATTERN_SIZE; i++){
		savegame.storeByte(this.offset+i, tempFile.readByte1(i));
	}
	this.refreshCanvas();
	closeDialog();
}
Pattern.prototype.export=function(){
	var size;
	if(savegame.readByte1(this.offset+0x69)==0x09){
		size=620;
	}else{
		size=2160;
	}

	var newFile=new HexFile(size);
	for(var i=0; i<size; i++){
		newFile.storeByte(i, savegame.readByte1(this.offset+i));
	}
	newFile.fileName=this.title+'.acnl';
	newFile.save();
}
function addPatternEvents(p){
	addEvent(p.canvas, 'click', function(){showPatternDialog(p)});
}
function showPatternDialog(p){
	tempFileLoadFunction=function(){
		p.importFromTempFile();
	};
	el('pattern-preview').src=p.canvas.toDataURL('image/png');
	el('pattern-preview-title').innerHTML='<b>'+p.title+'</b> by '+p.author;
	exportPattern=function(){p.export()}
	openDialog('pattern');
}















function Building(type, n){
	this.n=n;
	this.type=type;

	if(type==='map')
		this.offset=0x049528+n*4;
	else if(type==='island')
		this.offset=0x06b428+n*4;

	this.id=savegame.readByte2(this.offset);
	this.x=savegame.readByte1(this.offset+2);
	this.y=savegame.readByte1(this.offset+3);

	if(this.id!=0xf8)
		this.createEditRow(this.id);

	buildings.push(this);
}
Building.prototype.set=function(newId){
	this.id=newId;
	if(newId==0xf8){
		this.x=0;
		this.y=0;
	}

	this.tr.span.innerHTML=el('add-building-'+this.id).innerHTML;
}
Building.prototype.remove=function(newId){
	this.id=0xf8;
	this.x=0;
	this.y=0;

	if(this.tr){
		el('buildings').removeChild(this.tr);
		this.tr=null;
	}
}
Building.prototype.createEditRow=function(){
	var inputX=createInput(this.x);
	var inputY=createInput(this.y);
	inputX.className='coord';
	inputY.className='coord';

	var tr=document.createElement('tr');
	var td0=document.createElement('td');
	if(this.type==='island'){
		td0.innerHTML='i.'+this.n;
	}else{
		td0.innerHTML=this.n;
	}
	td0.className='count';

	var span;
	if(el('add-building-'+this.id)){
		span=createSpan(el('add-building-'+this.id).innerHTML);
	}else{
		span=createSpan('(?)');
	}
	var td1=document.createElement('td'); td1.appendChild(span);
	var td2=document.createElement('td'); td2.appendChild(inputX);
	var td3=document.createElement('td'); td3.appendChild(inputY);
	tr.appendChild(td0);
	tr.appendChild(td1);
	tr.appendChild(td2);
	tr.appendChild(td3);


	var editButton=null;
	/*if(this.id>=0x08 && this.id<=0x11){
		
	}else */if(isProtectedBuilding(this.id)){
		inputX.disabled=true;
		inputY.disabled=true;

	}else if(!isEditableBuilding(this.id) && this.type==='map' && el('add-building-'+this.id)){
		editButton=createButton('Edit');
		
		var td4=document.createElement('td'); td4.appendChild(editButton);
		tr.appendChild(td4);
	}

	addBuildingEvents(this, inputX, inputY, editButton);

	el('buildings').appendChild(tr);

	this.tr=tr;
	this.tr.span=span;
}
Building.prototype.save=function(){
	savegame.storeByte2(this.offset, this.id);
	savegame.storeByte(this.offset+2, this.x);
	savegame.storeByte(this.offset+3, this.y);
}
Building.prototype.setX=function(x){
	x=parseInt(x);
	if(x && x>=0 && x<96 && x!=NaN && x!=null)
		this.x=x;
	else
		alert('Invalid value.');
}
Building.prototype.setY=function(y){
	y=parseInt(y);
	if(y && y>=0 && y<80 && y!=NaN && y!=null)
		this.y=y;
	else
		alert('Invalid value.');
}
function addBuildingEvents(b,inputX,inputY,editButton){
	addEvent(inputX, 'change', function(){b.setX(this.value)});
	addEvent(inputY, 'change', function(){b.setY(this.value)});

	if(editButton){
		addEvent(editButton, 'click', function(){openBuildingDialog(b.n)});
	}
}
function openBuildingDialog(slot){
	el('building-slot').value=slot;

	if(slot==null){
		el('add-building-list').value=0x4c;
	}else{
		el('add-building-list').value=buildings[slot].id;
	}
	openDialog('building')
}
/*function newBuilding(){
	var found=false;
	var slot=55;

	while(!found && slot>10){
		if(buildings[slot].id==0xf8 && !buildings[slot].tr){
			buildings[slot].createEditRow();
			openBuildingDialog(slot);
			found=true;
		}
		slot--;
	}
}*/
function acceptBuilding(){
	var slot=el('building-slot').value;

	var b=el('add-building-list').value;

	if(slot==null){
		var found=false;
		var slot=55;

		while(!found && slot>10){
			if(buildings[slot].id==0xf8){
				buildings[slot].set(b);
				found=true;
			}
			slot--;
		}
	}else{
		buildings[slot].set(b);
	}


	closeDialog();
}

function isEditableBuilding(id){
	return !((id>=0x4c && id<=0x4d) || id==0x59 || (id>=0x5e && id<=0x67) || (id>=0x6a && id<=0x8e) || (id>=0xa6 && id<=0xf7))
}
function isProtectedBuilding(id){
	return id==0x54 || id==0x55 || id==0x56 || id==0x57 || id==0x5a || id==0x5d || id==0xda || id==0xdb
}






function PastVillager(n){
	this.n=n;
	this.offset=0x03f17e+n*2;

	this.id=savegame.readByte2(this.offset);

	if(this.id>=0 && this.id<=334){
		this.button=createButton('?');
		this.updateButtonText();
		addPastVillagerEvents(this);

		var tr=document.createElement('tr');

		var td=document.createElement('td');
		td.innerHTML=(n+1);
		td.className='count';
		tr.appendChild(td);

		td=document.createElement('td');
		td.appendChild(this.button);
		tr.appendChild(td);

		el('past-villagers').appendChild(tr);
	}
}
PastVillager.prototype.save=function(){
	savegame.storeByte2(this.offset, this.id);
}
PastVillager.prototype.setVillager=function(newId){
	this.id=newId;
}
PastVillager.prototype.updateButtonText=function(){
	var text=el('villager-new-'+this.id).innerHTML;
	this.button.value=text;	
}




function Villager(n){
	this.n=n;
	this.offset=0x027c90+0x24f8*n;

	this.id=savegame.readByte2(this.offset);
	this.type=savegame.readByte1(this.offset+2);
	this.status=savegame.readByte4(this.offset+0x24c4);
	this.catchphrase=new UString(this.offset+0x24a6, 12).toString();

	if(this.id>=0 && this.id<=334){
		this.button=createButton('?');
		this.updateButtonText();
		addCurrentVillagerEvents(this);

		var tr=document.createElement('tr');

		var td=document.createElement('td');
		td.innerHTML=(n+1);
		td.className='count';
		tr.appendChild(td);

		td=document.createElement('td');
		td.appendChild(this.button);
		tr.appendChild(td);

		el('villagers').appendChild(tr);
	}

	villagers[n]=this;
}
Villager.prototype.save=function(){
	savegame.storeByte2(this.offset, this.id);
	savegame.storeByte(this.offset+2, this.type);

	//store status
	savegame.storeByte(this.offset+0x24c4+0, (this.status & 0x000000ff));
	//savegame.storeByte(this.offset+0x24c4+1, (this.status & 0x0000ff00) >> 8);
	//savegame.storeByte(this.offset+0x24c4+2, (this.status & 0x00ff0000) >> 16);
	//savegame.storeByte(this.offset+0x24c4+3, (this.status & 0xff000000) >> 24);
}
Villager.prototype.setVillager=function(newId,defaultBytes){
	var villagerInfo=el('villager-new-'+newId);
	this.id=newId;
	this.type=villagerInfo.type;
	if(defaultBytes){
		var data=villagerInfo.defaultData.split(',');
		for(var i=0; i<88; i++)
			savegame.storeByte(this.offset+0x244e+i, hexToInt(data[i]));

		var catchphrase=villagerInfo.catchphrase;
		for(var i=0; i<22; i++)
			savegame.storeByte(this.offset+0x24a6+i, 0x00);
		for(var i=0; i<catchphrase.length; i++)
			savegame.storeByte(this.offset+0x24a6+i*2, catchphrase.charCodeAt(i));
	}
}
/* >>> 0 forces to use unsigned values */
Villager.prototype.isBoxed=function(){return this.status==((this.status | 0x00000001) >>> 0)}
Villager.prototype.evict=function(){if(!this.isBoxed())this.status=(this.status | 0x00000001) >>> 0}
Villager.prototype.unbox=function(){if(this.isBoxed())this.status=(this.status & ~0x00000001) >>> 0}

Villager.prototype.updateButtonText=function(){
	var text=el('villager-new-'+this.id).innerHTML;
	if(this.isBoxed())
		text+=' (boxed)';
	this.button.value=text;	
}





function addCurrentVillagerEvents(v){
	addEvent(v.button, 'click', function(){openCurrentVillagerDialog(v.n)});
}
function addPastVillagerEvents(pv){
	addEvent(pv.button, 'click', function(){openPastVillagerDialog(pv.n)});
}
function openCurrentVillagerDialog(n){
	acceptVillagerEdit=acceptCurrentVillagerEdit;
	show('villager-current-options');
    el('villager-edit').value=n;
    el('villager-new').value=villagers[n].id;
    el('villager-default').checked=false;
    el('villager-boxed').checked=villagers[n].isBoxed();
    openDialog('villager')
}
function openPastVillagerDialog(n){
	acceptVillagerEdit=acceptPastVillagerEdit;
	hide('villager-current-options');
    el('villager-edit').value=n;
    el('villager-new').value=town.pastVillagers[n].id;
    openDialog('villager')
}
function acceptCurrentVillagerEdit(){
    var n=el('villager-edit').value;
    var newId=el('villager-new').value;
    villagers[n].setVillager(newId, el('villager-default').checked);

	if(el('villager-boxed').checked){
		villagers[n].evict();
	}else{
		villagers[n].unbox();
	}
	villagers[n].updateButtonText();
    closeDialog()
}
function acceptPastVillagerEdit(){
    var n=el('villager-edit').value;
    var newId=el('villager-new').value;
	town.pastVillagers[n].setVillager(newId);
	town.pastVillagers[n].updateButtonText();
    closeDialog()
}




function addPlayerEvents(p){
	var selectGender=createNumericSelect(2, ['Male', 'Female']);
	selectGender.id='gender'+p.n;
	addEvent(selectGender, 'change', function(){p.gender=this.value});
	selectGender.value=p.gender;
	el('gendercontainers').appendChild(selectGender);

	var selectFace=createNumericSelect(12);
	selectFace.id='face'+p.n;
	addEvent(selectFace, 'change', function(){p.face=this.value});
	selectFace.value=p.face;
	el('facecontainers').appendChild(selectFace);

	var selectTan=createNumericSelect(16);
	selectTan.id='tan'+p.n;
	addEvent(selectTan, 'change', function(){p.tan=this.value});
	selectTan.value=p.tan;
	el('tancontainers').appendChild(selectTan);

	for(var i=0; i<24; i++)
		addBadgeEvents(p, i);
}
const BADGES=[
	'Fishes','Bugs','Marine','Fish collection','Bug collection','Marine collection','Balloons','Visiting other towns',
	'Being visited','Watering flowers','Bank','Turnips','Medals','StreetPass','Weeds','Shopping',
	'Letters','Refurbishing','Catalog','K.K. Slider','Home points','Time played','Helping neighbors','Dream Suite'
];
function addBadgeEvents(p, b){
	var selectBadge=createNumericSelect(4, ['('+BADGES[b]+')', 'Bronze *', 'Silver **', 'Gold ***']);
	addEvent(selectBadge, 'change', function(){p.badges[b]=this.value});
	/*
	selectBadge.children[1].className='bronze';
	selectBadge.children[2].className='silver';
	selectBadge.children[3].className='gold';
	*/
	selectBadge.value=p.badges[b];
	el('badges'+p.n).appendChild(selectBadge);
}


function Player(n){
	this.n=n;
	this.offset=0x20+0x9f10*n;

	this.hairType=savegame.readByte1(this.offset+4);
	this.hairColor=savegame.readByte1(this.offset+5);
	this.face=savegame.readByte1(this.offset+6);
	this.eyeColor=savegame.readByte1(this.offset+7);
	this.tan=savegame.readByte1(this.offset+8);

	this.gender=savegame.readByte1(this.offset+0x55ba); //00: male, 01:female

	this.name=new UString(this.offset+0x55a8, 10);

	/* search all player ID references */
	var playerId=new Array(11); // 11*2=22 bytes
	for(var i=0; i<11; i++){
		playerId[i]=savegame.readByte2(this.offset+0x55a6+i*2);
	}

	this.playerIdReferences=new Array();
	if(playerId[0]!=0x0000)
		for(var offset=0; offset<522624-11*2; offset+=2){
			var found=true;
			for(var i=0; i<11 && found; i++){
				if(savegame.readByte2(offset+i*2)!=playerId[i]){
					found=false;
				}
			}
			if(found){
				this.playerIdReferences.push(offset);
				offset+=11*2;
			}
		}

	//this.townId=savegame.readBytes(this.offset+0x55bc, 20);
	this.townId1=savegame.readByte1(this.offset+0x55bc);
	this.townId2=savegame.readByte1(this.offset+0x55bc+1);
	this.townName=new UString(this.offset+0x55bc+2, 10);


	this.TPCregion=savegame.readByte1(this.offset+0x55d2);
	this.birthdayMonth=savegame.readByte1(this.offset+0x55d4);
	this.birthdayDay=savegame.readByte1(this.offset+0x55d5);
	this.registrationYear=savegame.readByte2(this.offset+0x55d6);
	this.registrationMonth=savegame.readByte1(this.offset+0x55d8);
	this.registrationDay=savegame.readByte1(this.offset+0x55d9);
/*
	this.houseSize=savegame.readByte1(this.offset+0x057e64);
	this.houseStyle=savegame.readByte1(this.offset+0x057e65);
	this.houseDoorShape=savegame.readByte1(this.offset+0x057e66);
	this.houseExterior=savegame.readByte1(this.offset+0x057e67);
	this.houseRoof=savegame.readByte1(this.offset+0x057e68);
	this.houseDoor=savegame.readByte1(this.offset+0x057e69);
	this.houseFence=savegame.readByte1(this.offset+0x057e6a);
	this.housePavement=savegame.readByte1(this.offset+0x057e6b);
	this.houseMailbox=savegame.readByte1(this.offset+0x057e6c);
	// all house size and style properties are also stored twice at +9
	this.houseSize2=savegame.readByte1(this.offset+0x057e6d);
*/


	this.patterns=new Array(10);
	for(var i=0; i<10; i++){
		this.patterns[i]=new Pattern(this.offset+0x2c+PATTERN_SIZE*i);
		el('patterns'+n).appendChild(this.patterns[i].canvas);
	}

	this.badges=new Array(24);
	for(var i=0; i<24; i++)
		this.badges[i]=savegame.readByte1(this.offset+0x569c+i);

	this.pockets=new Array(16);
	for(var i=0; i<this.pockets.length; i++){
		this.pockets[i]=new ItemSlot(this.offset+0x6bb0, i);
		el('pockets'+n).appendChild(this.pockets[i].tile);
	}

	this.dressers=new Array(10*6*3);
	for(var i=0; i<this.dressers.length; i++){
		this.dressers[i]=new ItemSlot(this.offset+0x8e18, i);
		el('dressers'+n).appendChild(this.dressers[i].tile);
	}

	this.islandBox=new Array(10*4);
	for(var i=0; i<this.islandBox.length; i++){
		this.islandBox[i]=new ItemSlot(this.offset+0x6e40, i);
		el('islandbox'+n).appendChild(this.islandBox[i].tile);
	}

	this.refreshJPG();

	addPlayerEvents(this);
}
Player.prototype.save=function(){
	savegame.storeByte(this.offset+6, this.face);
	savegame.storeByte(this.offset+8, this.tan);

	for(var i=0; i<24; i++){
		savegame.storeByte(this.offset+0x569c+i, this.badges[i]);
	}


	this.name.save();
	/* fix player ID references when changing gender */
	for(var i=0; i<this.playerIdReferences.length; i++){
		savegame.storeByte(this.playerIdReferences[i]+20, this.gender);
		//this.name.saveAt(this.playerIdReferences[i]);
	}
}
Player.prototype.refreshJPG=function(){
	var offset=this.offset+0x5724;

	if(savegame.readByte4(offset)==0xe1ffd8ff){
		var base64='';
		for(var j=0; j<0x1400 && (savegame.readByte1(offset+j)!=0xff || savegame.readByte1(offset+j+1)!=0xd9); j++){
			base64+=String.fromCharCode(savegame.readByte1(offset+j));
		}
		base64+=String.fromCharCode(0xff);
		base64+=String.fromCharCode(0xd9);
		el('player'+this.n+'-pic').src='data:image/jpg;base64,'+window.btoa(base64);
	}else{
		el('player'+this.n+'-pic').src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABoAQMAAAB7WGTGAAAABlBMVEUAAAD///+l2Z/dAAAAYElEQVQoz2NgGAV0BtXShj1yH4AMY2njMzw3QIzZZjk8Z0CM2zBGNYxhbf4GwpCGiUg+ywHrqpY4ln/vAyHbzI83QBhmOQcwGDA1Z6AMM16IFLMZDxqD8Rn7gYEOuJEMABRqIHbYizyBAAAAAElFTkSuQmCC'
	}
}
const MAX_BANK=[0x78,0x56,0xf9,0x8c,0x36,0x86,0x11,0x0d];
Player.prototype.maxBank=function(){
	if(confirm('Note: this feature is experimental. Do you want to set 999.999.999 bells to this player\'s bank?')){
		var bankOffset=this.offset+0x6b6c;
		for(var i=0; i<8; i++)
			savegame.storeByte(bankOffset+i, MAX_BANK[i])
	}
}
const FULL_ENCYCLOPEDIA=[0xfe,0xff,0x12,0xef,0x7f,0xfd,0x7d,0x87,0xc1,0x38,0x80,0xa3,0x01,0x00,0x00,0x00,0xf0,0xff,0xfb,0xff,0x83,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xef,0xff,0xff,0x29,0xd1,0xff,0xff,0xff,0x7f,0x3f,0xaf,0xef,0xff,0x7f,0x11,0x08,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xfc,0x5f,0xf7,0xfd,0x85,0xaf,0xff,0x77,0x04,0xf0,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xbf,0x67,0x01,0x75,0x79,0x3e,0xdd,0xb8];
Player.prototype.fillEncyclopedia=function(){
	if(confirm('Note: this feature is experimental. Do you want to fill encyclopedia up for this player?')){
		var encyclopediaOffset=this.offset+0x6c00;
		for(var i=0; i<FULL_ENCYCLOPEDIA.length; i++)
			savegame.storeByte(encyclopediaOffset+i, FULL_ENCYCLOPEDIA[i])
	}
}







function clickOnSearchResult(){el('items').value=this.id}
function searchItem(q){
	while(el('search-results').children[0]){
		el('search-results').removeChild(el('search-results').firstChild);
	}

	q=clean(q);
	if(!q || q.length<2){
		return 0
	}

	var results=0;
	q=new RegExp(q);
	var items=el('items').getElementsByTagName('option');

	for(var i=0; i<items.length && results<25; i++){
		var id=items[i].value;
		var cleanName=items[i].cleanName;

		if(q.test(cleanName)){
			var li=document.createElement('li');
			li.innerHTML=items[i].innerHTML;
			li.id=id;
			addEvent(li, 'click', clickOnSearchResult);
			el('search-results').appendChild(li);
			results++;
		}
	}
	if(results==25){
		var li=document.createElement('li');
		li.innerHTML='too many results...';
		el('search-results').appendChild(li);
	}
}



function createInput(defValue){var input=document.createElement('input');input.type='text';input.value=defValue;return input}
function createButton(t){var b=document.createElement('input');b.type='button';b.className='button';b.value=t;return b}
function createSpan(t){var s=document.createElement('span');s.innerHTML=t;return s}
function createOption(v,t){var o=document.createElement('option');o.value=v;o.innerHTML=t;return o}
function createNumericSelect(n, oldTexts, func){var vals=new Array(n);for(var i=0;i<n;i++)vals[i]=i;var texts;if(oldTexts)texts=oldTexts;else texts=vals;if(func)return createSelect(vals, texts, func);else return createSelect(vals, texts)}
function createSelect(vals,texts,func){var select=document.createElement('select');for(var i=0; i<vals.length; i++){var option=createOption(vals[i],texts[i]);select.appendChild(option)}if(func)addEvent(select, 'change', func);return select}










/* Borrowed from Thulinma http://www.thulinma.com/acnl/
Pattern structure

0x 00 - 0x 29 ( 42) = Pattern Title
0x 2A - 0x 2B (  2) = User ID
0x 2C - 0x 3F ( 20) = User Name
0x 40 - 0x 41 (  2) = Town ID
0x 42 - 0x 55 ( 20) = Town Name
0x 56 - 0x 57 (  2) = Unknown (values are usually random - changing seems to have no effect)
0x 58 - 0x 66 ( 15) = Color code indexes
0x 67		 (  1) = Unknown (value is usually random - changing seems to have no effect)
0x 68		 (  1) = Ten? (seems to always be 0x0A)
0x 69		 (  1) = Pattern type (normal patterns: 0x09, dresses: 0x00, photo boards: 0x08)
0x 6A - 0x 6B (  2) = Zero? (seems to always be 0x0000)
0x 6C - 0x26B (512) = Pattern Data 1 (mandatory)
0x26C - 0x46B (512) = Pattern Data 2 (optional)
0x46C - 0x66B (512) = Pattern Data 3 (optional)
0x66C - 0x86B (512) = Pattern Data 4 (optional)
0x86C - 0x86F (  4) = Zero padding (optional)
*/
function patternColor(clr){switch (clr){
//pinks
case 0x00:return"#FFEFFF";case 0x01:return"#FF9AAD";case 0x02:return"#EF559C";case 0x03:return"#FF65AD";
case 0x04:return"#FF0063";case 0x05:return"#BD4573";case 0x06:return"#CE0052";case 0x07:return"#9C0031";
case 0x08:return"#522031";
//reds
case 0x10:return"#FFBACE";case 0x11:return"#FF7573";case 0x12:return"#DE3010";case 0x13:return"#FF5542";
case 0x14:return"#FF0000";case 0x15:return"#CE6563";case 0x16:return"#BD4542";case 0x17:return"#BD0000";
case 0x18:return"#8C2021";
//oranges
case 0x20:return"#DECFBD";case 0x21:return"#FFCF63";case 0x22:return"#DE6521";case 0x23:return"#FFAA21";
case 0x24:return"#FF6500";case 0x25:return"#BD8A52";case 0x26:return"#DE4500";case 0x27:return"#BD4500";
case 0x28:return"#633010";
//pastels or something, I guess?
case 0x30:return"#FFEFDE";case 0x31:return"#FFDFCE";case 0x32:return"#FFCFAD";case 0x33:return"#FFBA8C";
case 0x34:return"#FFAA8C";case 0x35:return"#DE8A63";case 0x36:return"#BD6542";case 0x37:return"#9C5531";
case 0x38:return"#8C4521";
//purple
case 0x40:return"#FFCFFF";case 0x41:return"#EF8AFF";case 0x42:return"#CE65DE";case 0x43:return"#BD8ACE";
case 0x44:return"#CE00FF";case 0x45:return"#9C659C";case 0x46:return"#8C00AD";case 0x47:return"#520073";
case 0x48:return"#310042";
//pink
case 0x50:return"#FFBAFF";case 0x51:return"#FF9AFF";case 0x52:return"#DE20BD";case 0x53:return"#FF55EF";
case 0x54:return"#FF00CE";case 0x55:return"#8C5573";case 0x56:return"#BD009C";case 0x57:return"#8C0063";
case 0x58:return"#520042";
//brown
case 0x60:return"#DEBA9C";case 0x61:return"#CEAA73";case 0x62:return"#734531";case 0x63:return"#AD7542";
case 0x64:return"#9C3000";case 0x65:return"#733021";case 0x66:return"#522000";case 0x67:return"#311000";
case 0x68:return"#211000";
//yellow
case 0x70:return"#FFFFCE";case 0x71:return"#FFFF73";case 0x72:return"#DEDF21";case 0x73:return"#FFFF00";
case 0x74:return"#FFDF00";case 0x75:return"#CEAA00";case 0x76:return"#9C9A00";case 0x77:return"#8C7500";
case 0x78:return"#525500";
//blue
case 0x80:return"#DEBAFF";case 0x81:return"#BD9AEF";case 0x82:return"#6330CE";case 0x83:return"#9C55FF";
case 0x84:return"#6300FF";case 0x85:return"#52458C";case 0x86:return"#42009C";case 0x87:return"#210063";
case 0x88:return"#211031";
//ehm... also blue?
case 0x90:return"#BDBAFF";case 0x91:return"#8C9AFF";case 0x92:return"#3130AD";case 0x93:return"#3155EF";
case 0x94:return"#0000FF";case 0x95:return"#31308C";case 0x96:return"#0000AD";case 0x97:return"#101063";
case 0x98:return"#000021";
//green
case 0xA0:return"#9CEFBD";case 0xA1:return"#63CF73";case 0xA2:return"#216510";case 0xA3:return"#42AA31";
case 0xA4:return"#008A31";case 0xA5:return"#527552";case 0xA6:return"#215500";case 0xA7:return"#103021";
case 0xA8:return"#002010";
//icky greenish yellow
case 0xB0:return"#DEFFBD";case 0xB1:return"#CEFF8C";case 0xB2:return"#8CAA52";case 0xB3:return"#ADDF8C";
case 0xB4:return"#8CFF00";case 0xB5:return"#ADBA9C";case 0xB6:return"#63BA00";case 0xB7:return"#529A00";
case 0xB8:return"#316500";
//Wtf? More blue?
case 0xC0:return"#BDDFFF";case 0xC1:return"#73CFFF";case 0xC2:return"#31559C";case 0xC3:return"#639AFF";
case 0xC4:return"#1075FF";case 0xC5:return"#4275AD";case 0xC6:return"#214573";case 0xC7:return"#002073";
case 0xC8:return"#001042";
//gonna call this cyan
case 0xD0:return"#ADFFFF";case 0xD1:return"#52FFFF";case 0xD2:return"#008ABD";case 0xD3:return"#52BACE";
case 0xD4:return"#00CFFF";case 0xD5:return"#429AAD";case 0xD6:return"#00658C";case 0xD7:return"#004552";
case 0xD8:return"#002031";
//more cyan, because we didn't have enough blue-like colors yet
case 0xE0:return"#CEFFEF";case 0xE1:return"#ADEFDE";case 0xE2:return"#31CFAD";case 0xE3:return"#52EFBD";
case 0xE4:return"#00FFCE";case 0xE5:return"#73AAAD";case 0xE6:return"#00AA9C";case 0xE7:return"#008A73";
case 0xE8:return"#004531";
//also green. Fuck it, whatever.
case 0xF0:return"#ADFFAD";case 0xF1:return"#73FF73";case 0xF2:return"#63DF42";case 0xF3:return"#00FF00";
case 0xF4:return"#21DF21";case 0xF5:return"#52BA52";case 0xF6:return"#00BA00";case 0xF7:return"#008A00";
case 0xF8:return"#214521";
//greys
case 0x0F:return"#FFFFFF";case 0x1F:return"#ECECEC";case 0x2F:return"#DADADA";case 0x3F:return"#C8C8C8";
case 0x4F:return"#B6B6B6";case 0x5F:return"#A3A3A3";case 0x6F:return"#919191";case 0x7F:return"#7F7F7F";
case 0x8F:return"#6D6D6D";case 0x9F:return"#5B5B5B";case 0xAF:return"#484848";case 0xBF:return"#363636";
case 0xCF:return"#242424";case 0xDF:return"#121212";case 0xEF:return"#000000";

default:return '';
//0x?9 - 0x?E aren't used. Not sure what they do in-game. Can somebody test this?
//0xFF is displayed as white in-game, editing it causes a game freeze.
}}










function refreshFlagSelect(){
	var options=el('flag1').getElementsByTagName('option');
	for(var i=options.length-1; i>=1; i--){
		el('flag1').removeChild(options[i]);
	}

	if(el('item_'+el('items').value).parentNode.dataset.flags1){
		var newFlags1=el('item_'+el('items').value).parentNode.dataset.flags1.split(',');

		for(var i=0; i<newFlags1.length; i++){
			var matches=newFlags1[i].match(/^([0-9a-f]{2})(=(.+))?/);
			var value=hexToInt(matches[1]);
			var suffix;
			if(matches[2]){
				suffix=' '+matches[3];
			}else{
				suffix='0x'+matches[1];
			}

			var newOption=createOption(value,suffix);
			newOption.id='flag1_'+value;
			el('flag1').appendChild(newOption);
		}
	}

	if(el('items').value==0x3e || el('items').value==0x43 || el('items').value==0x48 || el('items').value==0x4d || el('items').value==0x52){
		el('flag2_unk').value=1;
		el('flag2_unk').innerHTML='0x01 mixed perfect';
	}else{
		el('flag2_unk').value=0;
		el('flag2_unk').innerHTML='0x00';
	}
}
function setMouseButton(evt){if(evt.which==3)mouseHeld=2;else if(evt.which==1)mouseHeld=1;else mouseHeld=0}
function mouseOverTile(itemSlot){
	/* prevent in-game events items (time capsule, signature form...) from being deleted in map or pockets */
	if(mouseHeld==1 && !(!itemSlot.updatedByUser && (itemSlot.item==0x30f9 || itemSlot.item==0x30fa || itemSlot.item==0x30fb || itemSlot.item==0x30a2 || itemSlot.item==0x30a3))){
		itemSlot.set(el('flag2').value,el('flag1').value,el('items').value);
		itemSlot.updatedByUser=true;
		if(AUTO_INCREMENT)
			el('items').selectedIndex=el('items').selectedIndex+1;
	}else if(mouseHeld==2){
		if(!el('item_'+itemSlot.item)){
			el('item_unk').value=itemSlot.item;
			el('item_unk').innerHTML='unknown item: 0x'+intToHex(itemSlot.item, 1);
		}
		el('items').value=itemSlot.item;

		refreshFlagSelect();
		if(!el('flag1_'+itemSlot.flag1)){
			var option=createOption(itemSlot.flag1,'0x'+intToHex(itemSlot.flag1, 1));
			el('flag1').appendChild(option);
		}
		el('flag1').value=itemSlot.flag1;

		if(itemSlot.flag2>0){
			el('flag2_unk').value=itemSlot.flag2;
			el('flag2_unk').innerHTML='0x'+intToHex(itemSlot.flag2,1);
		}
		if(itemSlot.flag2==0x80){
			el('flag2_unk').innerHTML='0x80 Buried';
		}

		el('flag2').disabled=(el('flag2_0').value==el('flag2_unk').value);
		el('flag2').value=itemSlot.flag2;
	}

	el('debug-name').innerHTML=itemSlot.name;
	el('debug-hex').innerHTML=itemSlot.nameHex;
	el('debug').style.top=(itemSlot.tile.offsetTop+24)+'px';
	el('debug').style.left=(itemSlot.tile.offsetLeft+24)+'px';
}



function ItemSlot(offset, n, mapPos){
	this.offset=offset+n*4;
	this.updatedByUser=false;
	if(mapPos)
		this.mapPos=mapPos;

	this.tile=document.createElement('div');
	//this.tile.offset=this;
	this.tile.className='tile';	
	addItemSlotEvents(this);	


	this.item=savegame.readByte2(this.offset);
	this.flag1=savegame.readByte1(this.offset+2);
	this.flag2=savegame.readByte1(this.offset+3);
	this.refreshTile();

	itemSlots.push(this);
}
ItemSlot.prototype.save=function(){
	//la-li-lu-le-lo fix
	if(this.tile.updatedByUser && (this.tile.item==2490*5 || this.tile.item==2490*5+1 || this.tile.item==1791*7 || this.tile.item==4179*3+2 || this.tile.item==6270*2)){
		this.set(0x00, 0x00, 0x7ffe);
	}

	savegame.storeByte2(this.offset, this.item);
	savegame.storeByte(this.offset+2, this.flag1);
	savegame.storeByte(this.offset+3, this.flag2);
}
ItemSlot.prototype.isWeed=function(){return (this.item>=0x7c && this.item<=0x7f) || (this.item>=0xcb && this.item<=0xcd) || (this.item==0xf8)}
ItemSlot.prototype.isBuried=function(){return this.flag2==0x80}
ItemSlot.prototype.isWatered=function(){return this.flag2==0x40}
ItemSlot.prototype.isWiltedFlower=function(){return (this.item>=0xce && this.item<=0xfb)}
//ItemSlot.prototype.isPresent=function()return this.flag2==0x20}????
ItemSlot.prototype.set=function(flag2,flag1,item){
	this.flag2=parseInt(flag2);
	this.flag1=parseInt(flag1);
	this.item=parseInt(item);

	this.refreshTile();
}
ItemSlot.prototype.refreshTile=function(){
	/* Update hex and name */
	var hex=intToHex(this.item,2);
	if(this.flag2){
		hex=intToHex(this.flag2,1)+' '+intToHex(this.flag1,1)+' '+hex;
	}else if(this.flag1){
		hex=intToHex(this.flag1,1)+' '+hex;
	}
	this.nameHex=hex;

	var name;
	if(el('item_'+this.item)){
		name=el('item_'+this.item).innerHTML;
	}else{
		name='?';
	}
	if(this.isBuried())name+=' (buried)';
	if(this.isWatered())name+=' (watered)';

	if(this.mapPos){
		this.name='<b>'+this.mapPos+': </b>'+name;
	}else{
		this.name=name;
	}


	/* Update tile color */
	var className='tile';
	if(this.item==0x009d)className+=' patternground';
	else if(this.item>=0x9f && this.item<=0xca)className+=' flower';
	else if(this.isWiltedFlower())className+=' wiltedflower';
	else if(this.item>=0x20a7 && this.item<=0x2112)className+=' money';
	else if(this.item>=0x98 && this.item<=0x9c)className+=' rock';
	else if(this.item>=0x2126 && this.item<=0x2239)className+=' song';
	else if(this.item>=0x223a && this.item<=0x227a)className+=' paper';
	else if(this.item>=0x227b && this.item<=0x2285)className+=' turnip';
	else if(this.item>=0x2286 && this.item<=0x2341)className+=' catchable';
	else if((this.item>=0x2342 && this.item<=0x2445) || this.item==0x2119 || this.item==0x211a)className+=' wallfloor';
	else if(this.item>=0x2446 && this.item<=0x28b1)className+=' clothes';
	else if(this.item>=0x28b2 && this.item<=0x2934)className+=' gyroids';
	else if(this.item>=0x2e2c && this.item<=0x2e2f)className+=' mannequin';
	else if(this.item>=0x2e30 && this.item<=0x2e8f)className+=' art';
	else if(this.item>=0x2e90 && this.item<=0x2ed2)className+=' fossil';
	else if(this.item>=0x303b && this.item<=0x307a)className+=' tool';
	else if(this.item!=0x7ffe)className+=' furniture'

	if(this.isWeed())className+=' weed';

	if(this.isBuried())className+=' buried';
	else if(!el('item_'+this.item))className+=' unknown'

	this.tile.className=className;
}
function addItemSlotEvents(itemSlot){
	var click=function(){mouseOverTile(itemSlot)};
	addEvent(itemSlot.tile,'click',prevent);
	addEvent(itemSlot.tile,'mousedown',setMouseButton);
	addEvent(itemSlot.tile,'mousedown',click);
	addEvent(itemSlot.tile,'mouseover',click);
}



const SIZE_ACRE=16*16;
const SIZE_MAP=SIZE_ACRE*5*4;
function fillAll(){
	if(confirm('Fill all with selected item?'))
		for(var i=0;i<SIZE_MAP;i++)
			if(itemSlots[i].item==0x7ffe)
				itemSlots[i].set(0x00,el('flag1').value,el('items').value)
}
function removeAll(){
	if(confirm('Remove all selected item?'))
		for(var i=0;i<SIZE_MAP;i++)
			if(itemSlots[i].item==el('items').value && itemSlots[i].flag1==el('flag1').value)
				itemSlots[i].set(0x00,0x00,0x7ffe)
}
function removeWeeds(){
	var weeds=0;
	if(confirm('Remove weeds?'))
		for(var i=0;i<SIZE_MAP;i++)
			if(itemSlots[i].isWeed()){
				itemSlots[i].set(0x00,0x00,0x7ffe);
				weeds++;
			}

	if(weeds)
		alert(weeds+' weeds were removed')
}
function waterFlowers(){
	var flowers=0;
	if(confirm('Water flowers?'))
		for(var i=0;i<SIZE_MAP;i++)
			if(itemSlots[i].isWiltedFlower()){
				itemSlots[i].set(0x40,itemSlots[i].flag1,itemSlots[i].item);
				flowers++
			}

	if(flowers)
		alert(flowers+' flowers were watered')
}












function changeSecureNANDValue(){
	if(tempFile.fileSize==522752){
		savegame.dataOffset=0x00;
		for(var i=0; i<8; i++)
			savegame.storeByte(i, tempFile.readByte1(i), 1);
		savegame.dataOffset=0x80;
		refreshSecureValue();
	}
}
function refreshSecureValue(){
	savegame.dataOffset=0x00;

	var secureValue='';
	for(var i=0; i<8; i++)
		secureValue+=intToHex(savegame.readByte1(i), 1);

	savegame.dataOffset=0x80;

	el('nand-value').value=secureValue
}



function loadSavegameFromFile(file){
	if(!file){
		alert('No savegame was specified.');
		return null;
	}

	savegame=new HexFile(file, initializeEverything);
}
function initializeEverything(){
	if(!el('home')){
		alert('Everything is initialized :-P');
		return null;
	}

	if(savegame.fileSize==522752){
		refreshSecureValue();
		savegame.dataOffset=0x80;
	}else if(savegame.fileSize==786432){
		alert('WARNING: Your RAM file format is outdated (768kB). It will be fixed automatically after saving.');
		alert('Make sure you are using the latest RAM dumping/injecting method or you may screw your savegame.');
		var fixedSavegame=new HexFile(524288);
		fixedSavegame.fileName=savegame.fileName;
		fixedSavegame.fileType=savegame.fileType;
		for(var i=0; i<524288; i++){
			fixedSavegame.storeByte(i, savegame.readByte1(i));
		}
	
		savegame=fixedSavegame;
		hide('tab-button-advanced');
	}else{
		hide('tab-button-advanced');
	}

	/*	check valid file size and AC:NL header
		524288: RAM dump
		522752: garden.dat
		1183744: mori.bin (LeafTools) RAM dump
		1245184: mori.bin (LeafTools) RAM dump 2?
	*/
	var byte1=savegame.readByte4(0);
	var byte2=savegame.readByte4(4);
	if((savegame.fileSize!=524288 && savegame.fileSize!=522752 && savegame.fileSize!=1183744 && savegame.fileSize!=1245184) || (byte1!=0x98d1ed64 || byte2!=0x000200f8)){
		alert('Invalid RAM/savegame file.');
		return null;
	}




	/* read XML data */
	var groups=xmlData.getElementsByTagName('itemgroup');
	for(var i=0; i<groups.length; i++){
		var optGroup=document.createElement('optgroup');
		optGroup.label=groups[i].attributes.getNamedItem('title').value;
		el('items').appendChild(optGroup);

		if(groups[i].attributes.getNamedItem('flags1')){
			optGroup.dataset.flags1=groups[i].attributes.getNamedItem('flags1').value;
		}

		
		//var onlyMap=getXMLBoolean(groups[i], 'onlymap');
		//var onlyPockets=getXMLBoolean(groups[i], 'onlypockets');
		var items=groups[i].getElementsByTagName('item');
		for(var j=0; j<items.length; j++){
			if(items[j].attributes.getNamedItem('id')){
				var itemId=getXMLId(items[j]);

				var text=getXMLLang(items[j]);
				if(items[j].attributes.getNamedItem('copyof')){
					var copyOf=hexToInt(items[j].attributes.getNamedItem('copyof').value);
					text=el('item_'+copyOf).innerHTML+' ('+text+')';
				}


				var newOption=createOption(itemId, text);
				newOption.id='item_'+itemId;
				newOption.cleanName=clean(text);
				optGroup.appendChild(newOption);

				//newOption.onlyMap=onlyMap;
				//newOption.onlyPockets=onlyPockets;
			}
		}
	}

	/* read buildings XML data */
	var buildingsXML=xmlData.getElementsByTagName('building');
	for(var i=0; i<buildingsXML.length; i++){
		var id=getXMLId(buildingsXML[i]);
		var option=createOption(id, getXMLLang(buildingsXML[i]));
		option.id='add-building-'+id;
		el('add-building-list').appendChild(option);
		if(isProtectedBuilding(id) || isEditableBuilding(id)){
			option.disabled=true;
		}else if(id==0x4c){
			el('add-building-list').value=id;
		}
	}

	/* read villagers XML data */
	var villagersXML=xmlData.getElementsByTagName('villager');
	for(var i=0; i<333; i++){
		var villagerId=getXMLId(villagersXML[i]);
		var opt=createOption(villagerId, getXMLLang(villagersXML[i]));
		opt.id='villager-new-'+villagerId;
		opt.type=getXMLAttribute(villagersXML[i], 'type');
		opt.catchphrase=getXMLAttribute(villagersXML[i], 'catchen');
		opt.defaultData=getXMLAttribute(villagersXML[i], 'data');
		el('villager-new').appendChild(opt);
	}
	xmlData=null; /* hoping garbage collector does its job */



	/* Map */
	itemSlots=new Array();
	acres=new Array();
	var nTiles=0;
	for(var i=0; i<5*4; i++){
		var acre=document.createElement('div');
		acre.className='acre';
		el('map').appendChild(acre);
		
		var acreX=i%5;
		var acreY=parseInt(i/5);
		acre.id='acre'+(acreX+1)+'_'+(acreY+1);

		for(var j=0; j<SIZE_ACRE; j++){
			var x=j%16;
			var y=parseInt(j/16);

			var itemSlot=new ItemSlot(0x04da58, nTiles, (acreX*16+x+16)+'x'+(acreY*16+y+16));
			acre.appendChild(itemSlot.tile);
			nTiles++;
		}
	}
	for(var i=0; i<7*6; i++)
		var acre=new Acre('map', i);


	/* Island map */
	nTiles=0;
	for(var i=0; i<2*2; i++){
		var acre=document.createElement('div');
		acre.className='acre';
		el('island').appendChild(acre);

		
		var acreX=i%2;
		var acreY=parseInt(i/2);
		acre.id='acreisland'+(acreX+1)+'_'+(acreY+1);

		for(var j=0; j<SIZE_ACRE; j++){
			var itemSlot=new ItemSlot(0x06a428, nTiles);
			acre.appendChild(itemSlot.tile);
			nTiles++;
		}
	}
	for(var i=0; i<4*4; i++)
		var acre=new Acre('island', i);




	/* read player data */
	players=new Array(4);
	for(var i=0; i<4; i++)
		players[i]=new Player(i);




	/* read basic town info */
	town=new Town();

	var selectNativeFruit=createSelect([1,2,3,4,5,6,7,8,9,10,11,12], ['Apple','Orange','Pear','Peach','Cherry','Coconut*','Durian*','Lemon*','Lychee*','Mango*','Persimmon','*Banana*'], function(){town.nativeFruit=this.value});
	selectNativeFruit.id='nativefruit';
	selectNativeFruit.value=town.nativeFruit;
	el('nativefruitcontainer').appendChild(selectNativeFruit);

	var selectGrassType=createNumericSelect(3, ['Triangle / square (winter)', 'Circle / star (winter)', 'Square / circle (winter)'], function(){town.grassType=this.value});
	selectGrassType.id='grasstype';
	selectGrassType.value=town.grassType;
	el('grasstypecontainer').appendChild(selectGrassType);

	var townHallColorSelect=createSelect(generateTownHallColorIds(town.townId1), ['Gray','Brown','Green','Blue'], function(){town.townId1=this.value});
	townHallColorSelect.id='townhallcolor';
	townHallColorSelect.value=town.townId1;
	el('townhallcolorcontainer').appendChild(townHallColorSelect);

	var trainStationColorSelect=createSelect(generateTrainStationColorIds(town.townId2), ['Red','Green','Blue','Brown'], function(){town.townId2=this.value});
	trainStationColorSelect.id='trainstationcolor';
	trainStationColorSelect.value=town.townId2;
	el('trainstationcolorcontainer').appendChild(trainStationColorSelect);

	/* lost and found */
	for(var i=0; i<16; i++){
		var lostFound=new ItemSlot(0x05c75e, i);
		el('lostfound').appendChild(lostFound.tile);
	}




	/* read buildings and villagers ids */
	villagers=new Array(10);
	for(var i=0; i<10; i++)
		new Villager(i);
	buildings=new Array();
	for(var i=0; i<58; i++)
		new Building('map', i);
	for(var i=0; i<2; i++)
		new Building('island', i);


	/* read Labelle's patterns data */
	for(var i=0; i<8; i++){
		var pattern=new Pattern(0x05c8b4+i*PATTERN_SIZE);
		el('labelle').appendChild(pattern.canvas);
	}


	var showDebug=function(){show('debug')};
	var hideDebug=function(){hide('debug')};
	addEvent(el('map'),'mouseenter', showDebug);
	addEvent(el('map'),'mouseleave', hideDebug);
	addEvent(el('island'),'mouseenter', showDebug);
	addEvent(el('island'),'mouseleave', hideDebug);
	addEvent(el('lostfound'),'mouseenter', showDebug);
	addEvent(el('lostfound'),'mouseleave', hideDebug);
	var DEBUG_MAPS=['pockets','dressers','islandbox'];
	for(var i=0; i<DEBUG_MAPS.length; i++){
		for(var j=0; j<4; j++){
			var map=el(DEBUG_MAPS[i]+j);
			addEvent(map,'mouseenter', showDebug);
			addEvent(map,'mouseleave', hideDebug);
		}
	}

	addEvent(window, 'contextmenu', prevent);
	addEvent(window, 'mouseup', function(){mouseHeld=0});
	addEvent(el('map'), 'mousedown', prevent);
	document.body.removeChild(el('home'));
	show('header');
	show('editor');
	selectPlayer(0);
}


function selectPlayer(p){
	for(var i=0; i<4; i++){
		if(i==p){
			for(j=0; j<PLAYER_BLOCKS.length; j++)
				show(PLAYER_BLOCKS[j]+i);
			el('player'+i+'-pic').className='button active';
		}else{
			for(j=0; j<PLAYER_BLOCKS.length; j++)
				hide(PLAYER_BLOCKS[j]+i);
			el('player'+i+'-pic').className='button';
		}
	}

	if(p==0){
		el('current-player').innerHTML='Mayor';
	}else{
		el('current-player').innerHTML='Player '+(p+1);
	}
}








function saveChanges(){
	for(var i=0;i<itemSlots.length;i++)
		itemSlots[i].save();

	for(var i=0;i<4;i++)
		players[i].save();

	for(var i=0;i<acres.length;i++)
		acres[i].save();

	for(var i=0;i<buildings.length;i++)
		buildings[i].save();

	for(var i=0;i<villagers.length;i++)
		villagers[i].save();


	town.save();

	/* calculate checksums if garden.dat mode */
	if(savegame.dataOffset==0x80){
		updateChecksum(0x80, 0x1c);
		for(var i=0; i<4; i++){
			updateChecksum(0xa0+(0x9f10*i), 0x6b64);
			updateChecksum(0xa0+(0x9f10*i)+0x6b68, 0x33a4);
		}
		updateChecksum(0x27ce0, 0x218b0);
		updateChecksum(0x495a0, 0x44b8);
		updateChecksum(0x4da5c, 0x1e420);
		updateChecksum(0x6be80, 0x20);
		updateChecksum(0x6bea4, 0x13af8);
	}

	savegame.save();
}
/* crc32 function from http://stackoverflow.com/questions/18638900/javascript-crc32/18639999#18639999 */
const CRC_TABLE=[0x00000000,0xf26b8303,0xe13b70f7,0x1350f3f4,0xc79a971f,0x35f1141c,0x26a1e7e8,0xd4ca64eb,0x8ad958cf,0x78b2dbcc,0x6be22838,0x9989ab3b,0x4d43cfd0,0xbf284cd3,0xac78bf27,0x5e133c24,0x105ec76f,0xe235446c,0xf165b798,0x30e349b,0xd7c45070,0x25afd373,0x36ff2087,0xc494a384,0x9a879fa0,0x68ec1ca3,0x7bbcef57,0x89d76c54,0x5d1d08bf,0xaf768bbc,0xbc267848,0x4e4dfb4b,0x20bd8ede,0xd2d60ddd,0xc186fe29,0x33ed7d2a,0xe72719c1,0x154c9ac2,0x061c6936,0xf477ea35,0xaa64d611,0x580f5512,0x4b5fa6e6,0xb93425e5,0x6dfe410e,0x9f95c20d,0x8cc531f9,0x7eaeb2fa,0x30e349b1,0xc288cab2,0xd1d83946,0x23b3ba45,0xf779deae,0x05125dad,0x1642ae59,0xe4292d5a,0xba3a117e,0x4851927d,0x5b016189,0xa96ae28a,0x7da08661,0x8fcb0562,0x9c9bf696,0x6ef07595,0x417b1dbc,0xb3109ebf,0xa0406d4b,0x522bee48,0x86e18aa3,0x748a09a0,0x67dafa54,0x95b17957,0xcba24573,0x39c9c670,0x2a993584,0xd8f2b687,0x0c38d26c,0xfe53516f,0xed03a29b,0x1f682198,0x5125dad3,0xa34e59d0,0xb01eaa24,0x42752927,0x96bf4dcc,0x64d4cecf,0x77843d3b,0x85efbe38,0xdbfc821c,0x2997011f,0x3ac7f2eb,0xc8ac71e8,0x1c661503,0xee0d9600,0xfd5d65f4,0x0f36e6f7,0x61c69362,0x93ad1061,0x80fde395,0x72966096,0xa65c047d,0x5437877e,0x4767748a,0xb50cf789,0xeb1fcbad,0x197448ae,0x0a24bb5a,0xf84f3859,0x2c855cb2,0xdeeedfb1,0xcdbe2c45,0x3fd5af46,0x7198540d,0x83f3d70e,0x90a324fa,0x62c8a7f9,0xb602c312,0x44694011,0x5739b3e5,0xa55230e6,0xfb410cc2,0x092a8fc1,0x1a7a7c35,0xe811ff36,0x3cdb9bdd,0xceb018de,0xdde0eb2a,0x2f8b6829,0x82f63b78,0x709db87b,0x63cd4b8f,0x91a6c88c,0x456cac67,0xb7072f64,0xa457dc90,0x563c5f93,0x082f63b7,0xfa44e0b4,0xe9141340,0x1b7f9043,0xcfb5f4a8,0x3dde77ab,0x2e8e845f,0xdce5075c,0x92a8fc17,0x60c37f14,0x73938ce0,0x81f80fe3,0x55326b08,0xa759e80b,0xb4091bff,0x466298fc,0x1871a4d8,0xea1a27db,0xf94ad42f,0x0b21572c,0xdfeb33c7,0x2d80b0c4,0x3ed04330,0xccbbc033,0xa24bb5a6,0x502036a5,0x4370c551,0xb11b4652,0x65d122b9,0x97baa1ba,0x84ea524e,0x7681d14d,0x2892ed69,0xdaf96e6a,0xc9a99d9e,0x3bc21e9d,0xef087a76,0x1d63f975,0x0e330a81,0xfc588982,0xb21572c9,0x407ef1ca,0x532e023e,0xa145813d,0x758fe5d6,0x87e466d5,0x94b49521,0x66df1622,0x38cc2a06,0xcaa7a905,0xd9f75af1,0x2b9cd9f2,0xff56bd19,0x0d3d3e1a,0x1e6dcdee,0xec064eed,0xc38d26c4,0x31e6a5c7,0x22b65633,0xd0ddd530,0x0417b1db,0xf67c32d8,0xe52cc12c,0x1747422f,0x49547e0b,0xbb3ffd08,0xa86f0efc,0x5a048dff,0x8ecee914,0x7ca56a17,0x6ff599e3,0x9d9e1ae0,0xd3d3e1ab,0x21b862a8,0x32e8915c,0xc083125f,0x144976b4,0xe622f5b7,0xf5720643,0x07198540,0x590ab964,0xab613a67,0xb831c993,0x4a5a4a90,0x9e902e7b,0x6cfbad78,0x7fab5e8c,0x8dc0dd8f,0xe330a81a,0x115b2b19,0x020bd8ed,0xf0605bee,0x24aa3f05,0xd6c1bc06,0xc5914ff2,0x37faccf1,0x69e9f0d5,0x9b8273d6,0x88d28022,0x7ab90321,0xae7367ca,0x5c18e4c9,0x4f48173d,0xbd23943e,0xf36e6f75,0x0105ec76,0x12551f82,0xe03e9c81,0x34f4f86a,0xc69f7b69,0xd5cf889d,0x27a40b9e,0x79b737ba,0x8bdcb4b9,0x988c474d,0x6ae7c44e,0xbe2da0a5,0x4c4623a6,0x5f16d052,0xad7d5351];
var crc32=function(bytes){
	//var crcTable = window.crcTable || (window.crcTable = makeCRCTable());
	var crc=0 ^ (-1);

	for(var i=0; i<bytes.length; i++){
		crc=(crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
	}

	return (crc ^ (-1)) >>> 0;
};
function updateChecksum(offset, length){
	savegame.dataOffset=0; //checksum are stored in real file offsets

	var bytes=new Array(length);
	for(var i=0; i<length; i++){
		bytes[i]=savegame.readByte1(offset+4+i);
	}

	var checksum=crc32(bytes);
	savegame.storeByte(offset, checksum%256);
	savegame.storeByte(offset+1, (checksum >> 8)%256);
	savegame.storeByte(offset+2, (checksum >> 16)%256);
	savegame.storeByte(offset+3, (checksum >> 24)%256);

	savegame.dataOffset=0x80; //restore real savegame offset
}












/* clean: cleans uncommon ASCII characters in a string */
function clean(s){
	s=s.toLowerCase();
	s=s.replace(/[ÀÁÄÂàáäâ]/g, 'a');
	s=s.replace(/[ÈÉËÊèéëê]/g, 'e');
	s=s.replace(/[ÌÍÏÎìíïî]/g, 'i');
	s=s.replace(/[ÒÓÖÔòóöô]/g, 'o');
	s=s.replace(/[ÙÚÜÛùúüû]/g, 'u');
	s=s.replace(/[Ññ]/g, 'n');
	s=s.replace(/[Çç]/g, 'c');
	s=s.replace(/\&/g, 'and');
	s=s.replace(/\€/g, 'euro');
	s=s.replace(/[\.\/\- ]/g, '_');
	s=s.replace(/[^\w]/g, '');
	s=s.replace(/_+/g, '_');
	s=s.replace(/^_|_$/g, '');
	return s;
}



/* HexFile.js by Marc */
function HexFile(source, func){
	if(typeof window.FileReader !== 'function'){
		alert('Your browser doesn\'t support FileReader.');
		return null
	}
	
	if(typeof source === 'object' && source.name && source.size /*&& source.type*/){
		this.file=source;
		this.fileName=this.file.name;
		this.fileSize=this.file.size;
		this.fileType=source.type;

		this.fileReader=new FileReader();
		this.fileReader.addEventListener('load', function(){this.dataView=new DataView(this.result)}, false);
		if(func)
			this.fileReader.addEventListener('load', func, false);
		this.fileReader.readAsArrayBuffer(this.file);


	}else if(typeof source === 'number'){
		this.fileSize=source;
		this.fileName='filename.bin';
		this.fileType='application/octet-stream';

		this.fileReader=new ArrayBuffer(this.fileSize);
		this.fileReader.dataView=new DataView(this.fileReader);

		if(func)
			func.call;
	}else{
		alert('Invalid type of file.');
		return null
	}

	this.dataOffset=0;
}
HexFile.prototype.readByte1=function(pos){return this.fileReader.dataView.getUint8(pos+this.dataOffset)}
HexFile.prototype.readByte2=function(pos){return this.readByte1(pos+1)*0x0100+this.readByte1(pos)}
HexFile.prototype.readByte4=function(pos){return this.readByte1(pos+3)*0x01000000+this.readByte1(pos+2)*0x010000+this.readByte1(pos+1)*0x0100+this.readByte1(pos)}
HexFile.prototype.readBytes=function(pos,nBytes){var bytes=new Array(nBytes);for(var i=0;i<nBytes;i++)bytes[i]=this.readByte1(pos+i);return bytes}
HexFile.prototype.storeByte=function(pos,byte){this.fileReader.dataView.setUint8(pos+this.dataOffset, byte)}
HexFile.prototype.storeByte2=function(pos,bytes){this.storeByte(pos,bytes%256);this.storeByte(pos+1, parseInt(bytes/256))}
HexFile.prototype.save=function(){
	var blob;
	try{
		blob=new Blob([this.fileReader.dataView], {type: this.fileType});
	}catch(e){
		//old browser, using BlobBuilder
		window.BlobBuilder=window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder;
		if(e.name == 'TypeError' && window.BlobBuilder){
			var bb=new BlobBuilder();
			bb.append(this.fileReader.dataView.buffer);
			blob=bb.getBlob(this.fileType);
		}else if(e.name=='InvalidStateError'){
			blob=new Blob([this.fileReader.dataView.buffer],{type:this.fileType});
		}else{
			alert('Incompatible browser.');
		}
	}
	saveAs(blob, this.fileName)
}
	
	
/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */
var saveAs=saveAs||(navigator.msSaveBlob&&navigator.msSaveBlob.bind(navigator))||(function(h){var r=h.document,l=function(){return h.URL||h.webkitURL||h},e=h.URL||h.webkitURL||h,n=r.createElementNS("http://www.w3.org/1999/xhtml","a"),g="download" in n,j=function(t){var s=r.createEvent("MouseEvents");s.initMouseEvent("click",true,false,h,0,0,0,0,0,false,false,false,false,0,null);t.dispatchEvent(s)},o=h.webkitRequestFileSystem,p=h.requestFileSystem||o||h.mozRequestFileSystem,m=function(s){(h.setImmediate||h.setTimeout)(function(){throw s},0)},c="application/octet-stream",k=0,b=[],i=function(){var t=b.length;while(t--){var s=b[t];if(typeof s==="string"){e.revokeObjectURL(s)}else{s.remove()}}b.length=0},q=function(t,s,w){s=[].concat(s);var v=s.length;while(v--){var x=t["on"+s[v]];if(typeof x==="function"){try{x.call(t,w||t)}catch(u){m(u)}}}},f=function(t,u){var v=this,B=t.type,E=false,x,w,s=function(){var F=l().createObjectURL(t);b.push(F);return F},A=function(){q(v,"writestart progress write writeend".split(" "))},D=function(){if(E||!x){x=s(t)}if(w){w.location.href=x}v.readyState=v.DONE;A()},z=function(F){return function(){if(v.readyState!==v.DONE){return F.apply(this,arguments)}}},y={create:true,exclusive:false},C;v.readyState=v.INIT;if(!u){u="download"}if(g){x=s(t);n.href=x;n.download=u;j(n);v.readyState=v.DONE;A();return}if(h.chrome&&B&&B!==c){C=t.slice||t.webkitSlice;t=C.call(t,0,t.size,c);E=true}if(o&&u!=="download"){u+=".download"}if(B===c||o){w=h}else{w=h.open()}if(!p){D();return}k+=t.size;p(h.TEMPORARY,k,z(function(F){F.root.getDirectory("saved",y,z(function(G){var H=function(){G.getFile(u,y,z(function(I){I.createWriter(z(function(J){J.onwriteend=function(K){w.location.href=I.toURL();b.push(I);v.readyState=v.DONE;q(v,"writeend",K)};J.onerror=function(){var K=J.error;if(K.code!==K.ABORT_ERR){D()}};"writestart progress write abort".split(" ").forEach(function(K){J["on"+K]=v["on"+K]});J.write(t);v.abort=function(){J.abort();v.readyState=v.DONE};v.readyState=v.WRITING}),D)}),D)};G.getFile(u,{create:false},z(function(I){I.remove();H()}),z(function(I){if(I.code===I.NOT_FOUND_ERR){H()}else{D()}}))}),D)}),D)},d=f.prototype,a=function(s,t){return new f(s,t)};d.abort=function(){var s=this;s.readyState=s.DONE;q(s,"abort")};d.readyState=d.INIT=0;d.WRITING=1;d.DONE=2;d.error=d.onwritestart=d.onprogress=d.onwrite=d.onabort=d.onerror=d.onwriteend=null;h.addEventListener("unload",i,false);return a}(self));
