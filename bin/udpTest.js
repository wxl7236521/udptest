#! /usr/bin/env node
const udp=require('dgram');
const { program } = require('commander');

program
  .option('-s, --server', 'start Server')
  .option('-c, --client', 'start Client')
  .option('-p, --port <type>', 'set port')
  .option('-ip, --ip <type>', 'set ip')
  .option('-id, --id <type>', 'set send id')
  .option('-np, --numPacket <type>', 'set numPacket','1')
  .option('-sc, --sendCount <type>', 'set sendCount','100')
  .option('-pc, --perCount <type>', 'set perCount','1')
  .option('-itl, --interval <type>', 'set interval','100')
  .option('-st, --socketType <type>', 'set SocketType ipv4=udp4;ipv6=udp6','udp4');

//返回变量类型
function getType(obj){
	switch(obj){
		case null:
			return 'null';
		case undefined:
			return 'undefined';
	}
	var s=Object.prototype.toString.call(obj);
	switch(s){
		case '[object String]':
			return 'string';
		case '[object Number]':
			return 'number';
		case '[object Boolean]':
			return 'boolean';
		case '[object Array]':
			return 'array';
		case '[object Date]':
			return 'date';
		case '[object Function]':
			return 'function';
		case '[object RegExp]':
			return 'regExp';
		case '[object Object]':
			return 'object';
		default:
			return 'object';
	}
}
var StreamReader = function(bufferLimit){
	var _bufferLimit = bufferLimit || (1024 * 32);
	var self = this;
	var _buffers = []; //缓存数组，每个节点为一个push传入的一个Buffer
	var _curBuffer; //当前正在
	var _curBufferOffset = 0;
	var _bufferDataTotal = 0
	var _tasks = []; //读取任务{type: 'once' | 'loop', total: xx, packLen:yy, index:zz, cbFunc: function() }
	var _curTask;

	this.taskEmpty = function(){
		return (_curTask == undefined) && (_tasks.length == 0);
	};

	function getDataFromBuffers(len){
		var ret = Buffer.alloc(len);
		var offset = 0;
		while(len > 0){
			var copyLen = 0; //本次从当前Buffer中copy出去的数据长度
			var curBuffLeftLen = 0; //当前buffer剩余数据长度
			if(_curBuffer) curBuffLeftLen = _curBuffer.length - _curBufferOffset;
			copyLen = len;
			if(copyLen > curBuffLeftLen) copyLen = curBuffLeftLen;
			if(copyLen > 0){
				_curBuffer.copy(ret,offset,_curBufferOffset,_curBufferOffset + copyLen);
				_curBufferOffset += copyLen;
				offset += copyLen;
				len -= copyLen;
				curBuffLeftLen -= copyLen;
			}
			if(curBuffLeftLen == 0){
				_curBuffer = _buffers.shift();
				_curBufferOffset = 0;
			}

		}
		_bufferDataTotal -= ret.length;
		return ret;
	}

	function refreshCurTask(){
		if(_tasks.length > 0) _curTask = _tasks.shift();
		else _curTask = undefined;
	}

	//返回满足任务的数据长度
	function taskWantDataLen(task){
		var ret = task.packLen;
		var taskLeftLen = task.total - task.packLen * task.index;
		if(taskLeftLen < ret) ret = taskLeftLen;
		return ret;
	}

	function callLoopTask(task){
		var readlen = taskWantDataLen(task);
		var retData = getDataFromBuffers(readlen);
		task.cbFunc(retData,task.index);
		task.index++;
		//是否已经读完总数
		if(taskWantDataLen(task) <= 0) refreshCurTask();
	}

	var inShedule = false; //To avoid schedule recursively

	function schedule(){
		if(inShedule) return;
		else inShedule = true;
		if(!_curTask) refreshCurTask();
		//缓存数据达到要求的数据量
		while(_curTask && (_bufferDataTotal >= taskWantDataLen(_curTask))){
			if(_curTask.type == 'once'){ //单次任务
				var retData = getDataFromBuffers(_curTask.packLen);
				_curTask.cbFunc(retData);
				refreshCurTask();
			}else{ //多次任务
				callLoopTask(_curTask);
			}
		}
		inShedule = false;
	}

	/*流读取函数
    调用格式： StreamReader.read(len, function(data){...})
        可连续调用：StreamReader.read(4, func1).read(10, func2)
    参数：len为要读取的长度，
        cbFunc 为读取到指定长度或出错后的回调，回调的格式为cbFunc(data),data为Buffer格式
*/
	this.read = function(len,cbFunc){
		if(getType(cbFunc) != 'function')//如果没有带回调，则定义回调为空函数
			// eslint-disable-next-line nonblock-statement-body-position
			cbFunc = function(){};
		_tasks.push({
			type:'once',
			total:len,
			packLen:len,
			index:0,
			cbFunc:cbFunc
		});
		schedule();
		return this;
	};

	/*多次流读取函数
    调用格式： StreamReader.loopRead(total, packLen, function(data){...})
        可连续调用：StreamReader.loopRead(4, func1).read(100, 10, func2)
    参数：total为要读取的总长度， packLen为每次读取的长度，最后一次读取可能小于packLen
        cbFunc 为读取到指定长度或出错后的回调，回调的格式为cbFunc(data, index),
            data为Buffer格式
*/
	this.loopRead = function(total,packLen,cbFunc){
		if(getType(cbFunc) != 'function')//如果没有带回调，则定义回调为空函数
			// eslint-disable-next-line nonblock-statement-body-position
			cbFunc = function(){};
		_tasks.push({
			type:'loop',
			total:total,
			packLen:packLen,
			index:0,
			cbFunc:cbFunc
		});
		schedule();
		return this;
	};
    
	this.push = function(data){
		//缓冲区不足，拒绝缓存数据
		if((data.length + _bufferDataTotal) > _bufferLimit) return false;
		_buffers.push(data);
		_bufferDataTotal += data.length;
		schedule();
		return true;
	};

	this.clear = function(){
		_buffers = []; //缓存数组，每个节点为一个push传入的一个Buffer
		_curBuffer = undefined; //当前正在
		_curBufferOffset = 0;
		_bufferDataTotal = 0
		_tasks = []; //读取任务{type: 'once' | 'loop', total: xx, packLen:yy, index:zz, cbFunc: function() }
		_curTask = undefined;
		return this;
	}

};
var TypeInfos={
	//This is a funtion table for Reader and Write of pack_parse.
	//The field name is function name of Reader and Writer object.
	//The bufferFunc is corresponding to reading or writting functions of BuFfer class of Nodejs.
	//The size is the length in byte of the fixed length data type
	UInt8:{bufferFunc:'UInt8',size:1},
	byte:{bufferFunc:'UInt8',size:1},
	uint8:{bufferFunc:'UInt8',size:1},
	UInt16:{bufferFunc:'UInt16',size:2},
	uint16:{bufferFunc:'UInt16',size:2},
	ushort:{bufferFunc:'UInt16',size:2},
	UInt32:{bufferFunc:'UInt32',size:4},
	uint32:{bufferFunc:'UInt32',size:4},
	Int8:{bufferFunc:'Int8',size:1},
	int8:{bufferFunc:'Int8',size:1},
	Int16:{bufferFunc:'Int16',size:2},
	int16:{bufferFunc:'Int16',size:2},
	short:{bufferFunc:'Int16',size:2},
	Int32:{bufferFunc:'Int32',size:4},
	int32:{bufferFunc:'Int32',size:4},
	/* 64bit integer is some problem, Nodjs Buffer does not provide reading or writting function
    UInt64:{bufferFunc:'Double', size:8},
    uint64:{bufferFunc:'Double', size:8},
    Int64:{bufferFunc:'Double', size:8},
    int64:{bufferFunc:'Double', size:8},
    */
	Float:{bufferFunc:'Float',size:4},
	float:{bufferFunc:'Float',size:4},
	Double:{bufferFunc:'Double',size:8},
	double:{bufferFunc:'Double',size:8},
	//string and fstring(Fixed length string), size is invalid
	string:{bufferFunc:'string',size:0},
	fstring:{bufferFunc:'fstring',size:0},
	vbuffer:{bufferFunc:'vbuffer',size:0},
	buffer:{bufferFunc:'buffer',size:0}
};
var Writer = function(){
	var _encoding = 'utf8';
	var _targetList = [];
	var _endian = 'B';
	var self = this;
	this.getEncoding = function(){
		return _encoding;
	};
	//Set encoding of string
	this.setEncoding = function(encode){
		_encoding = encode;
		return this;
	};
	//Set number fields endian: bigEndian
	this.bigEndian = function(){
		_endian = 'B';
		return self;
	};
	//Set number fields endian: littleEndian
	this.littleEndian = function(){
		_endian = 'L';
		return self;
	};
	function add(typeName,val,len){
		var typeInfo = TypeInfos[typeName];
		if(!typeInfo){//undefined
			throw('Type name is not validate: ' + typeName);
			return;
		}
		if(len == undefined){
			if(typeName == 'string' || (typeName == 'fstring')){
				len = Buffer.byteLength(val,_encoding);
			}else if((typeName == 'buffer') || (typeName == 'vbuffer')){
				len = val.length;
			}else{
				len = typeInfo.size;
			}
		}
		_targetList.push({typeInfo:typeInfo,data:val,len:len});
		return self;
	};
	this.pack = function(){
		//Get total length of result Buffer first
		var len = 0;
		for(let i=0;i<_targetList.length;i++){
			let item = _targetList[i];
			let typeInfo = item.typeInfo;
			if((typeInfo.bufferFunc == 'string') || (typeInfo.bufferFunc == 'vbuffer')){ //string with 4 bytes length field at beginning
				len += 4;
			}
			len += item.len;
		}
		var ret = Buffer.alloc(len); //Alloc result
		var offset = 0;
		//Package result
		for(let i=0;i<_targetList.length;i++){
			let item = _targetList[i];
			let typeInfo = item.typeInfo;
			var writeFunc;
			var tmpBuff;
			if(typeInfo.bufferFunc == 'string'){
				//Write string length as UInt32 before string body
				ret['writeUInt32' + _endian + 'E'](item.len,offset);
				offset += 4;
				ret.write(item.data,offset,item.len,_encoding);
			}else if(typeInfo.bufferFunc == 'vbuffer'){
				ret['writeUInt32' + _endian + 'E'](item.len,offset);
				offset += 4;
				item.data.copy(ret,offset,0);
			}else if((typeInfo.bufferFunc == 'fstring') || (typeInfo.bufferFunc == 'buffer')){ //fixed length string
				if(typeInfo.bufferFunc == 'fstring'){
					tmpBuff = Buffer.from(item.data,_encoding);
				}else{ //buffer
					tmpBuff = Buffer.from(item.data);
				}
				ret.fill(0,offset,item.len);
				if(item.len > tmpBuff.length) tmpBuff.copy(ret,offset,0);
				else tmpBuff.copy(ret,offset,0,item.len);
			}else{
				if(typeInfo.size == 1) //1 byte data
					// eslint-disable-next-line nonblock-statement-body-position
					writeFunc = 'write' + typeInfo.bufferFunc;
				else writeFunc = 'write' + typeInfo.bufferFunc + _endian + 'E';
				//console.log("function name: " + writeFunc);
				ret[writeFunc](item.data,offset);
			}
			offset += item.len;
		}
		self.clear();
		return ret;
	};
	this.clear = function(){
		_targetList = [];
	};
	//Traverse TypeInfos, add name as function to this writer object, such as UInt16, short...
	for(var i in TypeInfos){
		//Get a function, this function will call add()
		//For example, type name is 'short', and the function is: function(v){ return add("short", v); }
		//Attaching this function to writer object by calling eval() with script:
		//  this["short"] = function(v){ return add("short", v); }
		var addFuncScript;
		if((i == 'fstring') || (i == 'buffer')) //Add field function: writer.type(fieldName, len), such as writer.fstring(str, 10);
			// eslint-disable-next-line nonblock-statement-body-position
			addFuncScript = 'this["' + i + '"] = function(v, len){ return add("'+ i +'", v, len ); }'
		else //Add field function: writer.type(fieldName), such as: writer.UInt32(val)
			// eslint-disable-next-line nonblock-statement-body-position
			addFuncScript = 'this["' + i + '"] = function(v){ return add("'+ i +'", v); }'
		eval(addFuncScript);
	}
    
}
var Reader = function(srcBuffer){
	var _srcBuffer = srcBuffer;
	var _encoding = 'utf8';
	var _targetList = [];
	var _endian = 'B';
	var _offset = 0;
	var self = this;
	var _result = {};
	this.set = function(srcBuffer){
		_srcBuffer = srcBuffer;
		_result = {};
		_offset = 0;
		return this;
	};
	//Append a buffer to Reader as source data
	this.append = function(buff){
		_srcBuffer = Buffer.concat([_srcBuffer,buff]);
		//console.log(_srcBuffer);
		return this;
	};
	this.getEncoding = function(){
		return _encoding;
	};
	//setEncoding() & getEncoding() set/get string encoding mode such as 'utf8', 'ascii', 'hex', 'base64', etc.,
	//the more detail can reference to nodeJs docment for Buffer: Buffers and Character Encodings.
	this.setEncoding = function(encode){
		_encoding = encode;
		return this;
	};
	//Set endian format, bigEndian or LittleEndian
	this.bigEndian = function(){
		_endian = 'B';
		return self;
	};
	this.littleEndian = function(){
		_endian = 'L';
		return self;
	};
	function parseField(fieldName,typeName,len){
		var typeInfo = TypeInfos[typeName];
		if(!typeInfo){//undefined
			throw('Type name is not validate: ' + typeName);
			return;
		}
		if(len == undefined) len = typeInfo.size;
		var readFunc;
		if(typeInfo.bufferFunc == 'string'){
			//read string length
			len = _srcBuffer['readUInt32' + _endian + 'E'](_offset);
			_offset += 4;
			_result[fieldName] = _srcBuffer.toString(_encoding,_offset,_offset + len);
		}else if(typeInfo.bufferFunc == 'fstring'){ //fixed length string, 定长字符串，空余部分填0
			var strlen = 0;//Get string bytes length
			for(var i = _offset;i<_offset +len;i++){
				if(_srcBuffer[i] == 0) break;
				strlen++;
			}
			_result[fieldName] = _srcBuffer.toString(_encoding,_offset,_offset + strlen);
		}else if(typeInfo.bufferFunc == 'vbuffer'){
			//read buffer length
			len = _srcBuffer['readUInt32' + _endian + 'E'](_offset);
			_offset += 4;
			_result[fieldName] = Buffer.alloc(len);
			_srcBuffer.copy(_result[fieldName],0,_offset,_offset + len);
		}else if(typeInfo.bufferFunc == 'buffer'){ //buffer, must specify len
			//_result[fieldName] = new Buffer(len);
			_result[fieldName] = Buffer.alloc(len);
			_srcBuffer.copy(_result[fieldName],0,_offset,len);
		}else{
			if(typeInfo.size == 1) //1 byte data
				// eslint-disable-next-line nonblock-statement-body-position
				readFunc = 'read' + typeInfo.bufferFunc;
			else readFunc = 'read' + typeInfo.bufferFunc + _endian + 'E';
			//console.log("readFunc name: " + readFunc);
			_result[fieldName] = _srcBuffer[readFunc](_offset);
		}
		_offset += len;
		return self;
	};
	this.unpack = function(){
		return _result;
	};
	/*!
    Reader unpack with description table
    Description table likes as following:
    var descTable = [
     {name: 'field0', type: 'uint16'},
     {name: 'field1', type: 'fstring', length: 10},
     {name: 'field2', type: 'buffer', length: 10},
     {name: 'field3', type: 'string'}
    ];
    reader.unpackWithDescTable(descTable);
    */
	this.unpackWithDescTable = function(descTable){
		for(var i=0;i<descTable.length;i++){
			parseField(descTable[i].name,descTable[i].type,descTable[i].length);
		}
		return self.unpack();
	};
	//Traverse TypeInfos, add name as function to this writer object, such as UInt16, short...
	for(var i in TypeInfos){
		//Get a function, this function will call add()
		//For example, type name is 'short', and the function is: function(v){ return parseField(name, "short"); }
		//Attaching this function to reader object by calling eval() with script:
		//  this["short"] = function(v){ return parseField(name, "short"); }
		var addFuncScript;
		if((i == 'fstring') || (i == 'buffer')) //Add field function: reader.type(fieldName, len)
			// eslint-disable-next-line nonblock-statement-body-position
			addFuncScript = 'this["' + i + '"] = function(name, len){ return parseField(name, "'+ i +'", len ); }'
		else //Add field function: reader.type(fieldName)
			// eslint-disable-next-line nonblock-statement-body-position
			addFuncScript = 'this["' + i + '"] = function(name){ return parseField(name, "'+ i +'" ); }'
		eval(addFuncScript);
	}
}
const PACK_TYPE_ECHO = 1;
const PACK_TYPE_STR = 2;
// const numPacket=63;//发送大小63K
// const sendCount=10;//发送次数
// const perCount=3;//每次同时发送个数
// const interval=1000;//间隔时间（毫秒）
// const ipServer='192.168.1.102';//发送ip--192.168.1.102--10.0.2.98
// const portServer=51232;//发送端口--41235
// const isClinet=false;//true 客户端 false 服务端
// const portClinet=51232;//接收端口--51232
// const socketType='udp4';//ip类型 ipv4=udp4;ipv6=udp6
class udpTest{
	constructor(numPacket,sendCount,perCount,interval,ipServer,portServer,isClinet,portClinet,socketType){
		this.numPacket=numPacket;//发送大小63K
		this.sendCount=sendCount;//发送次数
		this.perCount=perCount;//每次同时发送个数
		this.interval=interval;//间隔时间（毫秒）
		this.ipServer=ipServer;//发送ip
		this.portServer=portServer;//发送端口--41235
		this.isClinet=isClinet;//true 客户端 false 服务端
		this.portClinet=portClinet;//接收端口--51232
		this.socketType=socketType;////ip类型 ipv4=udp4;ipv6=udp6
		this.currentReceive=new Map();//接收数据数组
		this.lostReceive=new Map();//丢失数据数组
		this.sockStreamReader=new StreamReader(1024*64);
		this.init()
	};
	sendData(id){
		if(this.isClinet){
			const paserWriter = new Writer().bigEndian();
			const bytecount=32;//发送字节长度
			let loopStr='';//1K
			for(let i=0;i<bytecount;i++){loopStr+='This is a test loop string apple';}
			let loopStr2='';//1K
			for(let i=0;i<this.numPacket;i++){loopStr2+=loopStr;}
			const dataLen = Buffer.byteLength(loopStr2,paserWriter.getEncoding());
            console.log('单次发送大小：'+dataLen+'，发送次数：'+this.sendCount+'，每次同时发送：'+this.perCount+'，间隔时间：'+this.interval);
			let sendPackage=[];
			let intervalcount=0;
			for(let i = 0;i < this.sendCount;i++){
				(function(intervalcount,sendPackage,udpTest){
					setTimeout(function(){
						let data = paserWriter.UInt32(id).byte(PACK_TYPE_STR).UInt32(dataLen).UInt32(i + 1).UInt32(udpTest.sendCount).buffer(Buffer.from(loopStr2)).pack();
						sendPackage.push(data);
						if((i + 1)%udpTest.perCount==0||i==udpTest.sendCount-1){
							for(let m of sendPackage){
								udpTest.send(m,udpTest.portServer,udpTest.ipServer);
							}
						}
					},(intervalcount + 1) * udpTest.interval);
				})(intervalcount,sendPackage,this)
				if((i + 1)%this.perCount==0||i==this.sendCount-1){
					sendPackage=[];
					intervalcount+=1;
				}
			}
		}
	}
	init(){
		// creating a client socket
		const that=this;
		that.client=udp.createSocket({type:that.socketType,reuseAddr:true});
		if(that.isClinet){
			//that.client.bind(that.portClinet);
		}else{
			that.client.bind(that.portServer);
		}
		that.client.on('listening',function(){
			const address = that.client.address();
			const port = address.port;
			const family = address.family;
			const ipaddr = address.address;
			console.log('port :' + port);
			console.log('ip :' + ipaddr);
		});
		that.client.on('message',function(msg,info){
			//If no more task in StreamReader, register protocol handle body
			if(that.sockStreamReader.taskEmpty()) that.registerProtocolBody();
                    
			//When socket data coming, push to StreamReader
			that.sockStreamReader.push(msg);
		});
		that.client.on('error',function(error){
			console.log('Error: '+error);
		});
	}
	//sending msg
	send(o,port,ip){
		this.client.send(o,port,ip,function(error){
			if(error){
				console.log('Data sent !!!'+error);
			}
		});
	}
	registerProtocolBody(){
		const that=this;
		that.sockStreamReader.read(17,function(headData){//读取固定长度为25个字节的包头
			///解析头
			const parserReader=new Reader(headData).bigEndian();
			const head=parserReader.UInt32('id',4).byte('type').UInt32('length').UInt32('num').UInt32('count').unpack();
			//ID(4 bytes) | Type(1 byte) | Length(4 byte) | num(4 byte) | count(4 byte) | Data
			console.log(head)
			switch(head.type){
				case PACK_TYPE_ECHO:
					//根据head.length读取数据
					that.sockStreamReader.read(head.length,function(data){
						const dataStr=data.toString();
						console.info('Echo pack coming with string: '+dataStr);
					});
					break;
				case PACK_TYPE_STR:
					var flag=false;
					var files=that.currentReceive.get(head.id);
					if(files==undefined){
						files=[];
						files.push(head.num);
						that.currentReceive.set(head.id,files);
					}else{
						for(let i of files){
							if(i==head.num){
								flag=true;
							}
						}
						if(flag==false){
							files.push(head.num);
							that.currentReceive.set(head.id,files);
						}
					}
					var total=0;
					that.sockStreamReader.loopRead(head.length,head.length,function(data){//StreamReader将缓冲数据块直到它们达到所需的长度
						const dataStr=data.toString();
						//console.info('Long data pack come in: ' + dataStr);
						total+=data.length;
						if(head.num==head.count){
							console.log('接收消息：'+that.currentReceive.get(head.id))
							console.log('接收消息数量：'+that.currentReceive.get(head.id).length)
							var lostfiles=that.lostReceive.get(head.id);
							if(lostfiles==undefined){
								lostfiles=[];
								that.lostReceive.set(head.id,lostfiles);
							}
							for(let i=0;i<head.count;i++){
								let flag=false;
								for(let m of files){
									if(m==(i+1)){
										flag=true;
									}
								}
								if(flag==false){
									lostfiles.push(i+1)
									that.lostReceive.set(head.id,lostfiles);
								}
							}
							console.log('丢失消息：'+that.lostReceive.get(head.id))
							console.log('丢失消息数量：'+that.lostReceive.get(head.id).length)
						}
						if(total==head.length){console.info('Long data finished!')};
					});
					break;
				default:
					console.error('Unrecongized pack type: ' + head.type);
			}
		});
	}
}
module.exports=udpTest;
//new udpTest(null,null,null,null,null,51232,false,null,'udp4');//启动服务端，端口为--51232
//new udpTest(63,10,2,1000,'192.168.1.102',51232,true,41235,'udp4').sendData(1);//启动客户端，端口为--41235
//new udpTest(10,10,2,1000,'192.168.1.102',51232,true,41235).sendData(2);//启动客户端，端口为--41235
program.parse(process.argv);
//console.log(program.opts())
if (program.server&&program.port&&program.socketType) {
    new udpTest(null,null,null,null,null,program.port,false,null,program.socketType);
    console.log('udp服务端已成功运行，端口号'+program.port);
}
if (program.client&&program.port&&program.numPacket&&program.sendCount&&program.perCount&&program.interval
    &&program.ip&&program.socketType&&program.id)  {
    new udpTest(program.numPacket,program.sendCount,program.perCount,program.interval,program.ip,program.port,true,null,program.socketType).sendData(program.id)
}
if (!program.client&&!program.server)  {
    program.outputHelp();
}