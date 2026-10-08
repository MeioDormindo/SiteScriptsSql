// Dados deterministas para screenshots e testes de teclado (mesma origem: base e app leem o mesmo IndexedDB).
export const SEED=`(async function(){
  await Core.whenReady;
  var cats=[['c1','SELECT','#4ea8de'],['c2','UPDATE','#d4943a'],['c3','PROCEDURE','#f59e0b'],['c4','VIEW','#6366f1'],['c5','DELETE','#e04050']].map(function(c){return{id:c[0],name:c[1],color:c[2],createdAt:'2026-01-01T00:00:00.000Z'}});
  var folders=[['f1','Financeiro',null],['f2','Relatórios',"f1"],['f3','Estoque',null],['f4','Fechamento mensal','f2']].map(function(f){return{id:f[0],name:f[1],parentId:f[2],createdAt:'2026-01-01T00:00:00.000Z'}});
  var sql=["SELECT c.CustomerId, c.Name, SUM(o.Total) AS Total\\nFROM dbo.Customers c WITH (NOLOCK)\\nINNER JOIN dbo.Orders o ON o.CustomerId = c.CustomerId\\nWHERE o.CreatedAt >= DATEADD(DAY,-30,GETDATE())\\nGROUP BY c.CustomerId, c.Name\\nORDER BY Total DESC;",
    "UPDATE Produtos\\n   SET Preco = Preco * 1.05\\n WHERE Categoria = 'Bebidas'\\n   AND Ativo = 1; -- reajuste anual",
    "CREATE PROCEDURE dbo.FechamentoMensal @Ano INT, @Mes INT\\nAS\\nBEGIN\\n  SET NOCOUNT ON;\\n  SELECT COUNT(*) AS Pedidos, SUM(Total) AS Receita\\n  FROM dbo.Orders WHERE YEAR(CreatedAt) = @Ano AND MONTH(CreatedAt) = @Mes;\\nEND",
    "CREATE VIEW vw_EstoqueBaixo AS\\nSELECT p.Id, p.Nome, e.Quantidade\\nFROM Produtos p JOIN Estoque e ON e.ProdutoId = p.Id\\nWHERE e.Quantidade < 10;",
    "DELETE FROM LogAcesso WHERE DataHora < DATEADD(MONTH,-6,GETDATE());"];
  var names=['Clientes por receita','Reajuste de preços','Fechamento mensal','Estoque baixo','Limpeza de logs','Pedidos em aberto','Notas fiscais do dia','Top 10 produtos','Vendas por vendedor','Comissões','Inadimplentes','Ticket médio','Devoluções','Fornecedores ativos','Margem por categoria','Giro de estoque','Contas a pagar','Contas a receber','Fluxo de caixa','Clientes inativos','Pedidos cancelados','Frete por região','Usuários bloqueados','Auditoria de preços'];
  var scripts=names.map(function(n,i){
    var d=new Date(Date.UTC(2026,8,30-i,12,0,0)).toISOString();
    return{id:'s'+(i<10?'0':'')+i,name:n,content:sql[i%sql.length],categoryId:cats[i%5].id,folderId:[null,'f1','f2','f3','f4'][i%5],createdAt:'2026-01-0'+(1+i%9)+'T10:00:00.000Z',updatedAt:d,tags:i%3===0?['relatorio','mensal']:[],versions:[],favorite:i%7===1,pinned:i===3};
  });
  S.data.scripts=scripts;S.data.folders=folders;S.data.categories=cats;
  S.data.settings.theme='dark';S.data.settings.language='pt';S.data.subscriptions=[];
  await dbSave(S.data);
  try{localStorage.removeItem('sqlsm-layout');localStorage.setItem('sqlsm-theme','dark');localStorage.setItem('sqlScriptFeatures','{"view":"list"}');sessionStorage.clear()}catch(e){}
  return scripts.length;
})()`;
