import json
from pathlib import Path
string={'type':'string','minLength':1,'maxLength':256}
integer={'type':'integer','minimum':0}
positive={'type':'integer','minimum':1}
def arr(items,maxItems=400,minItems=0):return {'type':'array','items':items,'minItems':minItems,'maxItems':maxItems}
def obj(props,required=None):return {'type':'object','properties':props,'required':list(props) if required is None else required,'additionalProperties':False}
def ref(name):return {'$ref':'#/$defs/'+name}
cell={'type':'array','prefixItems':[integer,integer],'items':False,'minItems':2,'maxItems':2}
piece=obj({'id':string,'name':{'type':'string','maxLength':256},'color':{'type':'string','pattern':'^#[0-9a-fA-F]{6}$'},'symbol':{'type':'string','minLength':1,'maxLength':3},'cells':arr(ref('cell'),100,1)},['id','color','symbol','cells'])
ps=obj({'id':string,'version':positive,'allowRotations':{'type':'boolean'},'allowReflections':{'type':'boolean'},'pieces':arr(ref('piece'),30,1)},['id','version','pieces'])
board=obj({'width':{'type':'integer','minimum':1,'maximum':20},'height':{'type':'integer','minimum':1,'maximum':20},'mask':arr({'type':'string','pattern':'^[01]{1,20}$'},20,1),'templateId':string,'shapeLabel':string},['width','height','mask'])
placement=obj({'pieceId':string,'orientationKey':{'type':'string','maxLength':2000},'origin':ref('cell'),'cells':arr(ref('cell'),100,1)})
rules=obj({'allowRotations':{'type':'boolean'},'allowReflections':{'type':'boolean'},'solutionPolicy':{'enum':['unique','any-valid']}})
track={'enum':['baby','easy','medium','hard','expert']}
settings=obj({'method':{'enum':['automatic-1','automatic-2','silhouette-1']},'packingSeed':string,'pieceCount':{'type':'integer','minimum':8,'maximum':30},'fixedMin':integer,'fixedMax':integer,'seed':string,'fixedCount':integer,'nodeLimit':{'type':'integer','minimum':1,'maximum':10000000},'attemptLimit':{'type':'integer','minimum':1,'maximum':10000},'timeLimit':{'type':'integer','minimum':1,'maximum':300000},'policy':{'enum':['unique','any-valid']},'track':track},['seed','fixedCount','nodeLimit','attemptLimit','timeLimit','policy','track'])
stats=obj({**{k:integer for k in ['nodes','backtracks','forcedMoves','branchingPoints','maxDepth']},'elapsedMs':{'type':'number','minimum':0}})
difficulty=obj({'label':track,'estimatedScore':{'type':'number','minimum':0},'metricsVersion':string,'metrics':obj({**stats['properties'],'initialPlacements':{'type':'object','additionalProperties':integer},'rotationDiversity':integer,'reflectionEnabled':{'type':'boolean'}},stats['required']),'manualLabel':track},['label','estimatedScore','metricsVersion','metrics'])
validation=obj({'status':{'enum':['complete','timeout','cancelled','node_limit']},'solutionCount':integer,'countIsExact':{'type':'boolean'},'classification':{'enum':['unsolvable','unique','multiple','unknown']},'symmetryPolicy':{'const':'board-symmetries-count-separately'},'engineVersion':string})
level=obj({'id':string,'revision':positive,'order':positive,'kind':{'enum':['rectangle','silhouette']},'pieceSetId':string,'pieceSetVersion':positive,'pieceIds':arr(string,30,1),'board':ref('board'),'rules':ref('rules'),'fixedPlacements':arr(ref('placement'),30),'referenceSolution':arr(ref('placement'),30),'generation':ref('settings'),'difficulty':ref('difficulty'),'validation':ref('validation'),'revisionHistory':arr(ref('level'),100)},['id','revision','order','kind','pieceSetId','pieceSetVersion','pieceIds','board','rules','fixedPlacements','generation','difficulty','validation'])
root=obj({'schemaVersion':{'const':1},'game':{'const':'shape-packing-2d'},'catalogId':string,'catalogRevision':positive,'engineVersion':string,'coordinateSystem':{'const':'xy-zero-based'},'pieceSets':arr(ref('pieceSet'),1000,1),'tracks':obj({t:arr(ref('level'),1000) for t in track['enum']})})
root.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'urn:shape-puzzle-studio:catalog:1','$defs':{'cell':cell,'piece':piece,'pieceSet':ps,'board':board,'placement':placement,'rules':rules,'settings':settings,'stats':stats,'difficulty':difficulty,'validation':validation,'level':level}})
Path('src/engine/catalog.schema.json').write_text(json.dumps(root,indent=2)+'\n')
