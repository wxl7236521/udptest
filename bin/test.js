#! /usr/bin/env node
const {program} = require('commander');
const udpTest = require('./udpTest');

program
	.option('-s, --server','start Server')
	.option('-c, --client','start Client')
	.option('-p, --port <type>','set port')
	.option('-ip, --ip <type>','set ip')
	.option('-id, --id <type>','set send id')
	.option('-np, --numPacket <type>','set numPacket','1')
	.option('-sc, --sendCount <type>','set sendCount','100')
	.option('-pc, --perCount <type>','set perCount','1')
	.option('-itl, --interval <type>','set interval','100')
	.option('-st, --socketType <type>','set SocketType ipv4=udp4;ipv6=udp6','udp4');

program.parse(process.argv);
//console.log(program.opts())
if (program.server&&program.port&&program.socketType){
	new udpTest(null,null,null,null,null,program.port,false,null,program.socketType);
	console.log('udp服务端已成功运行，端口号'+program.port);
}
if (program.client&&program.port&&program.numPacket&&program.sendCount&&program.perCount&&program.interval
    &&program.ip&&program.socketType&&program.id){
	new udpTest(program.numPacket,program.sendCount,program.perCount,program.interval,program.ip,program.port,true,null,program.socketType).sendData(program.id)
}
if (!program.client&&!program.server){
	program.outputHelp();
}