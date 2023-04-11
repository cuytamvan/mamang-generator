const vscode = require('vscode');
const fs = require('fs');

async function getStub(type, moduleName) {
  const data = await fs.promises.readFile(`${__dirname}/stubs/${type}.stub`, 'utf-8');
  return data.replace(/{{moduleName}}/g, moduleName);
};

function convertToSnakeCase(str) {
  let newStr = str.replace(/[\w]([A-Z])/g, function(m) {
    return `${m[0]}_${m[1]}`;
  }).toLowerCase();
  const withEs = ['s', 'h', 'x', 'z'];

  if (withEs.find(r => r === newStr[newStr.length - 1])) newStr = `${newStr.substr(0, newStr.length - 1)}es`;
  else if(newStr[newStr.length - 1] === 'y') newStr = `${newStr.substr(0, newStr.length - 1)}ies`;
  else newStr = `${newStr}s`;

  return newStr;
}

function getNow() {
  const d = new Date();
  const m = d.getMonth() + 1 > 9 ? d.getMonth() + 1 : `0${d.getMonth() + 1}`;
  const time = {
    h: d.getHours() > 9 ? d.getHours() : `0${d.getHours()}`,
    m: d.getMinutes() > 9 ? d.getMinutes() : `0${d.getMinutes()}`,
    s: d.getSeconds() > 9 ? d.getSeconds() : `0${d.getSeconds()}`,
  };

  return `${d.getFullYear()}_${m}_${d.getDate() > 9 ? d.getDate() : `0${d.getDate()}`}_${time.h}${time.m}${time.s}`;
}

function activate(context) {
  const rootPath = `${vscode.workspace.rootPath}/app`;
  const repositoryPath = `${rootPath}/Repositories`;
  const modelPath = `${rootPath}/Models`;
  const controllerPath = `${rootPath}/Http/Controllers`;
  const resourcePath = `${rootPath}/Http/Resources`;
  const migrationPath = `${vscode.workspace.rootPath}/database/migrations`

  const disposable = vscode.commands.registerCommand('mamang-generator.helloWorld', function () {
    vscode.window.showInformationMessage('Hello World from Mamang Generator!');
  });

  const generateFile = vscode.commands.registerCommand('mamang-generator.laravel', async () => {
    const fileName = await vscode.window.showInputBox({
      placeHolder: 'Enter module name',
      prompt: 'Please enter module name'
    });

    if (fs.existsSync(rootPath)) {
      if (!fs.existsSync(repositoryPath)) {
        fs.mkdirSync(repositoryPath);
      }
      if (!fs.existsSync(resourcePath)) {
        fs.mkdirSync(resourcePath);
      }

      const repoCode = await getStub('laravel/repository', fileName);
      const modelCode = await getStub('laravel/model', fileName);
      const controllerCode = await getStub('laravel/controller', fileName);
      const resourceCode = await getStub('laravel/resource', fileName);
      const migrationCode = (await getStub('laravel/migration', '')).replace(/{{tableName}}/g, convertToSnakeCase(fileName));

      fs.writeFileSync(`${repositoryPath}/${fileName}Repository.php`, repoCode);
      fs.writeFileSync(`${modelPath}/${fileName}.php`, modelCode);
      fs.writeFileSync(`${controllerPath}/${fileName}Controller.php`, controllerCode);
      fs.writeFileSync(`${resourcePath}/${fileName}Resource.php`, resourceCode);
      fs.writeFileSync(`${migrationPath}/${getNow()}_create_${convertToSnakeCase(fileName)}_table.php`, migrationCode);

      vscode.window.showInformationMessage('Success generated');

    } else {
      vscode.window.showErrorMessage(`This workspace is not laravel project`);
    }
  });

  const generateFileFromJson = vscode.commands.registerCommand('mamang-generator.laravel-from-json', async () => {
    const fileModulePath = `${vscode.workspace.rootPath}/cuytamvan-module.json`;

    if (!fs.existsSync(fileModulePath)) {
      vscode.window.showErrorMessage('cuytamvan-module.json not found, please create cuytamvan-module.json');
      return;
    }

    const lengthRequired = ['string', 'double'];

    const fileModule = await fs.promises.readFile(fileModulePath, 'utf-8');
    const moduleDetail = JSON.parse(fileModule);

    let errors = [];
    const generateField = (field) => {
      let str = '$table->';
      if (field.type === 'string') str += `string('${field.name}', ${field.length})`;
      else if (field.type === 'double') str += `double('${field.name}', ${field.length}, ${field.length1})`;
      else if (field.type === 'enum') str += `enum('${field.name}', [${field.enum_list.map(r => `'${r}'`).join(',')}])`;
      else str += `${field.type}('${field.name}')`;

      if (field.attributes.length) str += '->' + field.attributes.map(r => `${r}()`).join('->');

      return `${str};`;
    }

    const moduleList = moduleDetail.modules.map(r => {
      const fields = r.fields.map(field => {
        let validate = true;
        if (lengthRequired.find(v => v === field.type) && !field.length) {
          errors = [...errors, `${r.name}.${field.name} length is required`];
          validate = false;
        }

        if (field.type === 'double' && !field.length1) {
          errors = [...errors, `${r.name}.${field.name} length1 is required`];
          validate = false;
        }

        return {
          name: field.name,
          field: validate ? generateField(field) : null,
        };
      });

      return {
        moduleName: r.name,
        fields,
        input: r.fields.map(r => r.name),
      }
    });

    if (errors.length) {
      vscode.window.showErrorMessage(errors[0]);
      return;
    }

    moduleList.map(async (r) => {
      const repoCode = await getStub('laravel/repository', r.moduleName);
      const modelCode = (await getStub('laravel/model', r.moduleName)).replace(
        '// fields',
        r.fields.map((r, index) => `${index !== 0 ? '        ' : ''}'${r.name}',`).join('\n')
      );
      const controllerCode = (await getStub('laravel/controller', r.moduleName)).replace(
        'protected $input = [];',
        `protected $input = [${r.input.map(name => `'${name}'`).join(', ')}];`
      );
      const resourceCode = (await getStub('laravel/resource', r.moduleName)).replace(
        '// other field',
        r.fields.map(field => `'${field.name}' => $this->${field.name},`)
          .map((name, index) => index === 0 ? name : `            ${name}`)
          .join('\n')
      );
      const migrationCode = (await getStub('laravel/migration', ''))
        .replace(/{{tableName}}/g, convertToSnakeCase(r.moduleName))
        .replace(
          '// fields',
          r.fields.filter(field => !!field)
            .map((field, index) => index === 0 ? field.field : `            ${field.field}`)
            .join('\n')
        );

      fs.writeFileSync(`${repositoryPath}/${r.moduleName}Repository.php`, repoCode);
      fs.writeFileSync(`${modelPath}/${r.moduleName}.php`, modelCode);
      fs.writeFileSync(`${controllerPath}/${r.moduleName}Controller.php`, controllerCode);
      fs.writeFileSync(`${resourcePath}/${r.moduleName}Resource.php`, resourceCode);
      fs.writeFileSync(`${migrationPath}/${getNow()}_create_${convertToSnakeCase(r.moduleName)}_table.php`, migrationCode);

      vscode.window.showInformationMessage('Success generated from cuytamvan-module.json');
    });
  });

  const generateBaseCollection = vscode.commands.registerCommand('mamang-generator.laravel-base-collection', async () => {
    const resourcePath = `${rootPath}/Http/Resources`;
    if (!fs.existsSync(resourcePath)) {
      fs.mkdirSync(resourcePath);
    }

    if (!fs.existsSync(`${resourcePath}/BaseCollection.php`)) {
      const code = await getStub('laravel/base-collection', '');
      fs.writeFileSync(`${resourcePath}/BaseCollection.php`, code);

      vscode.window.showInformationMessage('Success generated BaseCollection.php');
    } else {
      vscode.window.showInformationMessage('BaseCollection.php already exist 😉');
    }
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(generateFile);
  context.subscriptions.push(generateFileFromJson);
  context.subscriptions.push(generateBaseCollection);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
}
