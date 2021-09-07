const fs = require("fs");
const yaml = require("js-yaml");

try {
  let fileContents = fs.readFileSync("./subgraph_bak.yaml", "utf8");
  let data = yaml.load(fileContents);

  let cleanData = {
    datasources: data.dataSources.map((x) => {
      return {
        name: x.name,
        address: x.source.address,
        isDexStrategyV4 : x.source.abi === 'DexStrategyV4',
        abi: x.source.abi,
        startBlock: x.source.startBlock,
      };
    }),
  };
  fs.writeFileSync(
    "./subgraph_data.json",
    JSON.stringify(cleanData, null, 2),
    "utf8"
  );
} catch (e) {
  console.log(e);
}
