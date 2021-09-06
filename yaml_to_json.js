const fs = require('fs');
const yaml = require('js-yaml');

try {
    let fileContents = fs.readFileSync('./subgraph.yaml', 'utf8');
    let data = yaml.load(fileContents);

    let cleanData = data.dataSources.map(x=>{
        return {
            address : x.source.address,
            abi: x.source.abi,
            startBlock: x.source.startBlock
        }
    });
    fs.writeFileSync('./subgraph_data.json', JSON.stringify(cleanData,null,2), 'utf8');
    console.log(cleanData);
} catch (e) {
    console.log(e);
}
