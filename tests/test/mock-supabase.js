/* Supabase simulado em memoria para testes: emula RLS por usuario, o trigger LWW de sync_items,
   a geracao de codigo e versao de shared_lists e as RPCs get_shared_list/delete_my_account. */
(function(){
  var clock=Date.parse('2026-10-07T12:00:00.000Z');
  function stamp(){clock+=1;return new Date(Math.max(clock,Date.now())).toISOString()}
  var server=window.__server={rows:[],lists:[],calls:[],users:{'a@test.dev':{id:'11111111-1111-1111-1111-111111111111',password:'senha-forte-1'},'b@test.dev':{id:'22222222-2222-2222-2222-222222222222',password:'senha-forte-2'}},session:null,auth:null};
  var ALPHA='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  function genCode(){var s='';for(var i=0;i<8;i++)s+=ALPHA[Math.floor(Math.random()*ALPHA.length)];return s}
  function clone(v){return v==null?v:JSON.parse(JSON.stringify(v))}
  function pick(row,cols){if(!cols||cols==='*')return clone(row);var o={};cols.split(',').forEach(function(c){c=c.trim();o[c]=clone(row[c])});return o}
  function cmp(a,b){return a<b?-1:a>b?1:0}

  function Query(table){this.table=table;this.filters=[];this.orders=[];this.rangeArgs=null;this.cols='*';this.op='select';this.payload=null;this.isSingle=false;this.wantSelect=false}
  Query.prototype.select=function(cols){if(this.op==='select')this.cols=cols||'*';else{this.wantSelect=true;this.cols=cols||'*'}return this};
  Query.prototype.eq=function(c,v){this.filters.push(function(r){return r[c]===v});return this};
  Query.prototype.gte=function(c,v){this.filters.push(function(r){return Date.parse(r[c])>=Date.parse(v)});return this};
  Query.prototype.in=function(c,arr){this.filters.push(function(r){return arr.indexOf(r[c])>=0});return this};
  Query.prototype.order=function(c,o){this.orders.push([c,!(o&&o.ascending===false)]);return this};
  Query.prototype.range=function(a,b){this.rangeArgs=[a,b];return this};
  Query.prototype.single=function(){this.isSingle=true;return this};
  Query.prototype.upsert=function(rows){this.op='upsert';this.payload=rows;return this};
  Query.prototype.insert=function(row){this.op='insert';this.payload=row;return this};
  Query.prototype.update=function(p){this.op='update';this.payload=p;return this};
  Query.prototype.delete=function(){this.op='delete';return this};
  Query.prototype.then=function(res,rej){var self=this;return new Promise(function(r){setTimeout(function(){r(self.exec())},5)}).then(res,rej)};
  Query.prototype.match=function(r){return this.filters.every(function(f){return f(r)})};
  Query.prototype.exec=function(){
    var uid=server.session&&server.session.user.id;
    server.calls.push(this.table+':'+this.op);
    if(!uid)return{data:null,error:{code:'42501',message:'not authenticated'}};
    var self=this;
    if(this.table==='sync_items'){
      var mine=server.rows.filter(function(r){return r.user_id===uid});
      if(this.op==='select'){
        var out=mine.filter(function(r){return self.match(r)});
        out.sort(function(a,b){for(var i=0;i<self.orders.length;i++){var o=self.orders[i],c=cmp(a[o[0]],b[o[0]]);if(c)return o[1]?c:-c}return 0});
        if(this.rangeArgs)out=out.slice(this.rangeArgs[0],this.rangeArgs[1]+1);
        return{data:out.map(function(r){return pick(r,self.cols)}),error:null};
      }
      if(this.op==='upsert'){
        var done=[];
        this.payload.forEach(function(p){
          if(p.user_id!==uid)return;
          var now=stamp(),mod=p.modified_at;
          if(Date.parse(mod)>Date.parse(now)+300000)mod=now;
          var ex=server.rows.find(function(r){return r.user_id===uid&&r.kind===p.kind&&r.id===p.id});
          if(ex){if(Date.parse(mod)<=Date.parse(ex.modified_at))return;ex.data=p.deleted?null:clone(p.data);ex.deleted=!!p.deleted;ex.modified_at=mod;ex.updated_at=now;done.push(ex)}
          else{var n={user_id:uid,kind:p.kind,id:p.id,data:p.deleted?null:clone(p.data),deleted:!!p.deleted,modified_at:mod,updated_at:now};server.rows.push(n);done.push(n)}
        });
        return{data:this.wantSelect?done.map(function(r){return pick(r,self.cols)}):null,error:null};
      }
    }
    if(this.table==='shared_lists'){
      var own=server.lists.filter(function(l){return l.owner_id===uid});
      if(this.op==='select'){return{data:own.filter(function(l){return self.match(l)}).map(function(l){return pick(l,self.cols)}),error:null}}
      if(this.op==='insert'){
        if(own.length>=20)return{data:null,error:{code:'P0001',message:'list_limit'}};
        var l={id:'l'+Math.random().toString(16).slice(2,10),owner_id:uid,code:genCode(),name:this.payload.name,source_folder_id:this.payload.source_folder_id,version:1,snapshot:clone(this.payload.snapshot),script_count:this.payload.snapshot.scripts.length,created_at:stamp(),updated_at:stamp()};
        l.hash=JSON.stringify(l.snapshot);server.lists.push(l);
        return{data:pick(l,this.cols),error:null};
      }
      if(this.op==='update'){
        var t=own.find(function(l){return self.match(l)});if(!t)return{data:null,error:{code:'PGRST116',message:'no rows'}};
        var h=JSON.stringify(this.payload.snapshot||t.snapshot),nm=this.payload.name||t.name;
        if(h!==t.hash||nm!==t.name){t.version++;t.updated_at=stamp()}
        if(this.payload.snapshot){t.snapshot=clone(this.payload.snapshot);t.script_count=t.snapshot.scripts.length}t.name=nm;t.hash=h;
        return{data:pick(t,this.cols),error:null};
      }
      if(this.op==='delete'){server.lists=server.lists.filter(function(l){return!(l.owner_id===uid&&self.match(l))});return{data:null,error:null}}
    }
    return{data:null,error:{message:'unsupported '+this.table+' '+this.op}};
  };

  function makeClient(){
    var listeners=[];
    function emit(ev,s){server.session=s;listeners.forEach(function(cb){cb(ev,s)})}
    var auth={
      onAuthStateChange:function(cb){listeners.push(cb);setTimeout(function(){cb('INITIAL_SESSION',server.session)},0);return{data:{subscription:{unsubscribe:function(){}}}}},
      _emit:emit,
      signInWithPassword:function(c){var u=server.users[c.email];server.calls.push('signIn:'+c.email);if(!u||u.password!==c.password)return Promise.resolve({data:{},error:{code:'invalid_credentials',message:'Invalid login credentials'}});var s={user:{id:u.id,email:c.email}};setTimeout(function(){emit('SIGNED_IN',s)},0);return Promise.resolve({data:{session:s},error:null})},
      signUp:function(c){server.calls.push('signUp:'+c.email);return Promise.resolve({data:{user:{id:'x'},session:null},error:null})},
      resetPasswordForEmail:function(e){server.calls.push('reset:'+e);return Promise.resolve({data:{},error:null})},
      updateUser:function(p){server.calls.push('updateUser');if(p.password==='senha-forte-1')return Promise.resolve({data:{},error:{code:'same_password',message:'same'}});return Promise.resolve({data:{},error:null})},
      signOut:function(o){var scope=o&&o.scope||'global';server.calls.push('signOut:'+scope);if(scope!=='others')setTimeout(function(){emit('SIGNED_OUT',null)},0);return Promise.resolve({error:null})},
      resend:function(){server.calls.push('resend');return Promise.resolve({data:{},error:null})}
    };
    server.auth=auth;
    return{
      auth:auth,
      from:function(table){return new Query(table)},
      rpc:function(name,args){
        server.calls.push('rpc:'+name);
        return new Promise(function(r){setTimeout(function(){
          if(name==='get_shared_list'){var l=server.lists.find(function(x){return x.code===args.p_code});r({data:l?[{name:l.name,version:l.version,updated_at:l.updated_at,script_count:l.script_count,snapshot:args.p_known_version===l.version?null:clone(l.snapshot)}]:[],error:null});return}
          if(name==='delete_my_account'){var uid=server.session&&server.session.user.id;server.rows=server.rows.filter(function(x){return x.user_id!==uid});server.lists=server.lists.filter(function(x){return x.owner_id!==uid});r({data:null,error:null});return}
          r({data:null,error:{message:'unknown rpc'}});
        },5)});
      }
    };
  }
  window.supabase={createClient:function(){return makeClient()}};
})();
