"""Assuntos específicos de cada matéria, em três níveis: matéria → grupo → assunto.

Cada assunto tem (chave, rótulo, expressão). A expressão é aplicada à verbetação da ementa
(o cabeçalho, sem acentos, em minúsculas e sem os nomes das classes processuais). A ordem dos
grupos segue a estrutura da lei de regência de cada ramo. Os assuntos listados em GENERICOS só
aparecem no selo do julgado quando nenhum assunto mais específico da mesma matéria se aplica.
"""

ASSUNTOS = {
    "civil": [
        ("Parte geral", [
            ("pessoas", "Capacidade, pessoa jurídica e domicílio", r"capacidade civil|incapaz|emancipacao|morte presumida|\bausente\b|pessoa juridica sem fins|associac(ao|oes) civil|fundacao privada|domicilio civil"),
            ("personalidade", "Direitos da personalidade: imagem, honra e nome", r"direitos? da personalidade|direito (a|de) imagem|uso (indevido )?da imagem|nome civil|retificacao de (nome|registro civil)|\bhonra\b|privacidade|intimidade|liberdade de (imprensa|expressao)|materia jornalistica|reportagem"),
            ("internet", "Internet, redes sociais e proteção de dados", r"provedor|marco civil|12\.965|redes? sociais|remocao de conteudo|conteudo ofensivo|\blgpd\b|13\.709|protecao de dados|dados pessoais|vazamento de dados|esquecimento|perfil falso"),
            ("negocio-juridico", "Negócio jurídico, vícios e nulidades", r"negocio juridico|nulidade (do|de|da) (negocio|contrato|ato|clausula|escritura|doacao)|anulabilidade|anulacao (do|de) (negocio|contrato|escritura)|vicios? de consentimento|coacao|estado de perigo|lesao contratual|simulacao|fraude contra credores|pauliana|reserva mental"),
            ("prescricao-civ", "Prescrição e decadência", r"prescricao|prescricional|decadencia|decadencial"),
            ("bens", "Bens, frutos e benfeitorias", r"bens? (publicos? dominicais|moveis|imoveis por|acessorios|fungiveis)|pertenca|frutos e rendimentos|benfeitorias"),
        ]),
        ("Obrigações", [
            ("inadimplemento", "Inadimplemento, mora e perdas e danos", r"inadimplemento|adimplemento|\bmora\b|perdas e danos|clausula penal|multa (contratual|compensatoria|moratoria)|\barras\b|resolucao por inadimplemento"),
            ("juros-correcao", "Juros de mora e correção monetária", r"juros (de mora|moratorios|legais|compensatorios)|correcao monetaria|termo inicial (dos|de) juros|taxa selic|indice de correcao|art\. 406"),
            ("obrigacoes", "Pagamento, cessão de crédito e extinção das obrigações", r"obrigac(?!ao de (nao )?fazer)(?!oes de (nao )?fazer)|pagamento|quitacao|novacao|cessao de credito|assuncao de divida|sub-rogacao|solidariedade passiva|compensacao de (creditos|dividas)"),
            ("enriquecimento", "Enriquecimento sem causa e pagamento indevido", r"enriquecimento (sem causa|ilicito|indevido)|pagamento indevido|repeticao (do|de) indebito|restituicao em dobro|gestao de negocios"),
        ]),
        ("Contratos", [
            ("contratos", "Teoria geral, revisão e extinção dos contratos", r"\bcontrat|revisao contratual|onerosidade excessiva|resolucao (do|de) contrato|rescisao contratual|boa-fe objetiva|funcao social do contrato|exceptio|evicao|vicios? redibitori"),
            ("compra-venda", "Compra e venda, promessa e doação", r"compra e venda|promessa de compra|compromisso de compra|adjudicacao compulsoria|doacao|permuta|direito de preferencia|retrovenda|outorga (uxoria|conjugal)"),
            ("locacao", "Locação", r"locacao|locatari|locador|alugue(l|is)|despejo|renovatoria|8\.245|inquilinato"),
            ("prestacao-servicos", "Prestação de serviços, empreitada e construção", r"prestacao de servicos?|empreitada|construcao civil|obra (civil|contratada)|construtor"),
            ("mandato-corretagem", "Mandato, corretagem e honorários contratuais", r"corretagem|corretor|mandato|mandatario|honorarios contratuais|contrato de agencia|comissao de corretagem"),
            ("transporte", "Transporte", r"contrato de transporte|transporte (de pessoas|de passageiros|de carga|de mercadorias|rodoviario|maritimo|ferroviario)|transportador|conhecimento de transporte"),
            ("fianca", "Fiança e garantias pessoais", r"fianca|fiador|carta de fianca|garantia fidejussoria"),
            ("comodato-deposito", "Comodato, depósito e mútuo civil", r"comodato|contrato de deposito|depositario|mutuo civil|emprestimo entre particulares"),
        ]),
        ("Seguros", [
            ("seguro-vida", "Seguro de vida e acidentes pessoais", r"seguro de vida|acidentes pessoais|suicidio|beneficiario do seguro|seguro prestamista|invalidez permanente"),
            ("dpvat", "DPVAT", r"dpvat|seguro obrigatorio"),
            ("seguros", "Seguros de dano e regras gerais", r"\bseguros?\b|securitari|seguradora|segurado\b|sinistro|indenizacao securitaria|agravamento do risco|franquia do seguro|seguro garantia"),
        ]),
        ("Responsabilidade civil", [
            ("dano-moral", "Dano moral e seu valor", r"dano moral|danos morais|extrapatrimonia|in re ipsa|abalo moral|quantum indenizatorio"),
            ("danos-materiais", "Danos materiais, estéticos, lucros cessantes e pensão", r"danos? materia|lucros cessantes|dano estetico|perda de uma chance|pensionamento|pensao mensal|dano emergente"),
            ("resp-civil", "Responsabilidade civil em geral", r"responsabilidade civil|indenizac|dever de indenizar|ato ilicito|responsabilidade objetiva|nexo (de )?causal|excludente de responsabilidade|culpa exclusiva"),
            ("acidentes", "Acidentes de trânsito", r"acidente de transito|colisao|atropelamento|acidente automobilistico"),
            ("resp-profissional", "Erro médico, hospitais e profissionais liberais", r"erro medico|responsabilidade (civil )?(do|de|dos) (medicos?|hospita|profissiona|advogad|dentista)|hospital|clinica|cirurgi|obrigacao de meio"),
        ]),
        ("Direito das coisas", [
            ("posse", "Posse e ações possessórias", r"\bposse\b|possessori|reintegracao de posse|manutencao de posse|interdito proibitorio|esbulho|turbacao|direito de retencao"),
            ("usucapiao", "Usucapião", r"usucapiao|prescricao aquisitiva"),
            ("propriedade", "Propriedade, reivindicação e vizinhança", r"propriedade|reivindicat|imissao na posse|direitos? de vizinhanca|uso anormal|passagem forcada|aluviao|acessao|demarcacao"),
            ("condominio", "Condomínio", r"condomin|cotas? condominia|taxas? condominia|sindico|convencao de condominio|multipropriedade|assembleia condominial"),
            ("direitos-reais", "Direitos reais sobre coisa alheia e garantias reais", r"direitos? rea(l|is)|usufruto|servidao|direito de superficie|direito real de habitacao|hipoteca|penhor|anticrese|\blaje\b"),
        ]),
        ("Registros e propriedade intelectual", [
            ("registros", "Registros públicos e atividade notarial", r"registro de imoveis|registros? publicos?|6\.015|cartorio|tabeliao|tabelionato|notari|registrador|matricula (do|de) imove|averbacao|incorporacao imobiliaria|escritura publica"),
            ("autoral", "Direitos autorais", r"direitos? autora|\becad\b|obras? (intelectua|musica|literari|audiovisua)|9\.610|execucao publica|plagio"),
        ]),
    ],
    "familia": [
        ("Casamento e união estável", [
            ("casamento", "Casamento e regime de bens", r"casamento|regime de bens|pacto antenupcial|comunhao (parcial|universal)|separacao (total|obrigatoria|convencional|legal) de bens|meacao"),
            ("uniao-estavel", "União estável", r"uniao estavel|companheir|concubin|uniao homoafetiva|uniao paralela"),
            ("divorcio", "Divórcio, dissolução e partilha", r"divorcio|separacao judicial|partilha de bens|dissolucao (da sociedade conjugal|da uniao|do casamento)|sobrepartilha"),
        ]),
        ("Alimentos", [
            ("alimentos", "Fixação, revisão e exoneração de alimentos", r"alimentos|alimentar|pensao alimenticia|revisional de alimentos|exoneracao de alimentos|alimentando|alimentante|binomio"),
            ("execucao-alimentos", "Execução de alimentos e prisão civil", r"prisao civil|execucao de alimentos|cumprimento de sentenca de alimentos|rito da prisao|art\. 528|sumula 309"),
        ]),
        ("Filhos", [
            ("filiacao", "Filiação, paternidade e socioafetividade", r"paternidade|maternidade|filiacao|investigacao de paternidade|exame de dna|socioafetiv|multiparentalidade|registro de nascimento|reproducao assistida"),
            ("guarda", "Guarda, convivência e poder familiar", r"\bguarda\b|convivencia familiar|regime de visitas|direito de visita|alienacao parental|poder familiar|destituicao"),
            ("adocao", "Adoção", r"adocao|adotan|adotad|cadastro nacional de adocao|habilitacao para adocao"),
            ("infancia", "Estatuto da Criança e do Adolescente", r"crianca e do adolescente|\beca\b|medida socioeducativa|ato infracional|acolhimento institucional|menor de idade"),
            ("curatela", "Curatela, tutela e interdição", r"curatela|curador|interdicao|tomada de decisao apoiada|\btutor\b|tutela de menor"),
        ]),
        ("Sucessões", [
            ("sucessao-legitima", "Herdeiros, cônjuge e companheiro na sucessão", r"sucessao legitima|vocacao hereditaria|herdeir|heranca|concorrencia sucessoria|conjuge sobrevivente|companheir[oa] sobrevivente|colacao|sonegados|direito real de habitacao|renuncia a heranca|cessao de direitos hereditarios|sucess"),
            ("testamento", "Testamentos e legados", r"testament|legado|legatari|codicilo|fideicomisso|disposicao de ultima vontade|legitima dos herdeiros"),
            ("inventario", "Inventário e arrolamento", r"inventario|arrolamento|inventariante|espolio|partilha (em|no) inventario"),
        ]),
    ],
    "consumidor": [
        ("Planos de saúde", [
            ("saude-cobertura", "Cobertura e negativa de tratamento", r"cobertura|negativa (de|do) (tratamento|cobertura|atendimento)|recusa (de|da|do) (cobertura|tratamento)|rol (de procedimentos|da ans)|home care|tratamento|medicamento|cirurgia|terapia|autismo|\btea\b|urgencia e emergencia|reembolso"),
            ("saude-reajuste", "Reajuste e mensalidade", r"reajuste|faixa etaria|sinistralidade|mensalidade do plano|coparticipacao"),
            ("saude-contrato", "Rescisão, manutenção e portabilidade do plano", r"rescisao (unilateral )?do (contrato|plano)|cancelamento do plano|manutencao do plano|ex-empregado|aposentado|inativo|arts?\. 30 e 31|portabilidade|plano coletivo|carencia"),
            ("planos-saude", "Planos de saúde: outros temas", r"planos? de saude|operadora|\bans\b|seguro saude|autogestao"),
        ]),
        ("Contratos de consumo", [
            ("bancos-cons", "Bancos e crédito ao consumidor", r"instituic(ao|oes) financeira|correntista|conta corrente|emprestimo consignado|descontos? indevidos?|cartao de credito|cheque especial|financiamento de veiculo|contrato bancario|capitalizacao|juros remuneratorios"),
            ("imoveis-cons", "Imóveis, incorporação e consórcios", r"compra e venda de imove|incorporadora|construtora|atraso na entrega|consorcio|cooperativa habitacional|distrato imobiliario|\blote\b"),
            ("educacao-cons", "Ensino e mensalidades", r"instituic(ao|oes) de ensino|mensalidade|faculdade particular|curso superior|escola particular|diploma"),
            ("veiculos", "Veículos", r"veiculo|montadora|concessionaria de veiculos|automovel|recall"),
        ]),
        ("Serviços", [
            ("aereo", "Transporte de passageiros, aéreo e turismo", r"transporte aereo|companhia aerea|\bvoos?\b|bagagem|overbooking|pacote turistico|agencia de viagens|hotel|transporte (de passageiros|coletivo)|passageiro"),
            ("saude-servicos", "Hospitais, clínicas e serviços médicos", r"hospita|clinica|servicos? medicos?|erro medico|transfusao|laboratorio"),
            ("essenciais", "Energia, água, telefonia e internet", r"energia eletrica|telefonia|agua e esgoto|servicos? essencia|concessionaria de (energia|agua|servico)|internet|tv por assinatura|fornecimento de energia|corte (de|do) fornecimento"),
        ]),
        ("Responsabilidade do fornecedor", [
            ("fornecedor", "Vício e fato do produto ou serviço", r"fato (do|de) (produto|servico)|vicios? (do|de) (produto|servico)|vicios? de construcao|responsabilidade (civil )?(objetiva|do fornecedor|solidaria)|defeito|cadeia de fornecimento|garantia legal|culpa exclusiva"),
            ("cadastros", "Cadastros, negativação e protesto", r"cadastro|inadimplentes|negativac|inscricao indevida|\bspc\b|serasa|protesto|credit scoring|score|\bscr\b|sistema de informacoes de credito"),
        ]),
        ("Práticas comerciais", [
            ("praticas", "Práticas e cláusulas abusivas", r"abusiv|venda casada|arrependimento|cobranca indevida|repeticao em dobro|clausula (de )?(eleicao|limitativa)"),
            ("publicidade", "Oferta, publicidade e comércio eletrônico", r"publicidade|oferta|comercio eletronico|compra (pela|na|por) internet|marketplace|plataforma digital|propaganda"),
            ("superendividamento", "Superendividamento", r"superendividamento|minimo existencial|14\.181"),
        ]),
        ("Defesa em juízo", [
            ("defesa-cons", "Relação de consumo, inversão do ônus e ações coletivas", r"inversao do onus|hipossuficien|foro do (domicilio do )?consumidor|acao coletiva de consumo|procon|relacao de consumo|consumidor por equiparacao|bystander"),
        ]),
    ],
    "bancario": [
        ("Contratos e encargos", [
            ("juros", "Juros, capitalização e comissão de permanência", r"juros|capitalizacao|anatocismo|taxa media|comissao de permanencia|encargos (moratorios|contratuais)|\bcet\b"),
            ("tarifas", "Tarifas bancárias e seguros acessórios", r"tarifa|\btac\b|\btec\b|seguro prestamista|registro (do|de) contrato|avaliacao do bem|venda casada"),
            ("contratos-banc", "Contratos bancários, cédulas e prestação de contas", r"contratos? bancari|cedula de credito|mutuo|emprestimo|financiamento|conta (corrente|garantida)|prestacao de contas|cheque especial|renegociacao|repactuacao|arrendamento mercantil|liquidacao extrajudicial"),
            ("credito-rural", "Crédito rural", r"credito rural|cedula rural|pronaf|securitizacao"),
            ("superendividamento", "Superendividamento", r"superendividamento|minimo existencial|14\.181|repactuacao de dividas?"),
            ("consignado", "Crédito consignado", r"consignado|margem consignavel|desconto em folha"),
            ("cartao", "Cartão de crédito", r"cartao de credito|rotativo|cartao consignado|\brmc\b"),
        ]),
        ("Garantias", [
            ("fiduciaria", "Alienação fiduciária e busca e apreensão", r"alienacao fiduciaria|busca e apreensao|garantia fiduciaria|cessao fiduciaria|purgacao da mora|decreto-lei 911"),
            ("garantias-banc", "Aval e outras garantias bancárias", r"\baval\b|avalista|garantidor|devedor solidario|penhor"),
        ]),
        ("Crédito imobiliário", [
            ("sfh", "Crédito imobiliário e SFH", r"sistema financeiro da habitacao|\bsfh\b|\bfcvs\b|mutuario|credito imobiliario|financiamento habitacional|9\.514|leilao extrajudicial|alienacao fiduciaria de (bem )?imove"),
        ]),
        ("Responsabilidade do banco", [
            ("fraudes", "Fraudes, golpes, segurança e sigilo", r"fraude|golpe|nao autorizad|\bpix\b|seguranca bancaria|fortuito interno|saque indevido|transacoes? nao reconhecid|sumula 479|sigilo bancario|quebra de sigilo|dados bancarios|\blgpd\b|protecao de dados"),
        ]),
    ],
    "empresarial": [
        ("Sociedades", [
            ("sociedades", "Sociedades, sócios e administradores", r"societari|sociedades? (limitada|anonima|empresaria|simples)|destituicao de administrador|\bsocios?\b|acionista|quotas|assembleia geral|administrador da sociedade|acordo de socios"),
            ("dissolucao", "Dissolução e apuração de haveres", r"dissolucao (parcial|total|da sociedade)|apuracao de haveres|retirada de socio|exclusao de socio|direito de recesso"),
            ("cooperativas", "Cooperativas", r"cooperativ|ato cooperativo"),
            ("desconsideracao", "Desconsideração da personalidade jurídica", r"desconsideracao da personalidade|desconsideracao inversa|incidente de desconsideracao|grupo economico|confusao patrimonial|desvio de finalidade"),
        ]),
        ("Recuperação e falência", [
            ("recuperacao", "Recuperação judicial e extrajudicial", r"recuperacao (judicial|extrajudicial)|plano de recuperacao|stay period|recuperanda|assembleia (geral )?de credores|cram down"),
            ("falencia", "Falência", r"falenc|falid|massa falida|concordata|arrecadacao|termo legal"),
            ("creditos-concursais", "Créditos, juízo universal e atos constritivos", r"habilitacao de credito|impugnacao de credito|classificacao de creditos?|extraconcursal|creditos? concursa|trava bancaria|essencialidade|sujeicao (do|de) credito|11\.101|relacao de credores|juizo universal|atos constritivos|\blrf\b|juizo da recuperacao|coobrigad"),
        ]),
        ("Títulos de crédito", [
            ("titulos", "Cheque, duplicata, nota promissória e outros títulos", r"titulos? de credito|duplicata|nota promissoria|cheque|letra de cambio|endosso|protesto de titulo|cedula de produto rural"),
        ]),
        ("Contratos empresariais", [
            ("contratos-emp", "Franquia, representação comercial e distribuição", r"franquia|representacao comercial|representante comercial|contrato de distribuicao|agencia e distribuicao|contrato empresarial|contrato de fornecimento"),
            ("leasing", "Arrendamento mercantil (leasing) e factoring", r"arrendamento mercantil|leasing|factoring|fomento mercantil|\bvrg\b"),
        ]),
        ("Propriedade industrial", [
            ("marcas", "Marcas, concorrência desleal e nome empresarial", r"\bmarcas?\b|trade dress|conjunto-imagem|nome empresarial|concorrencia desleal|nome de dominio"),
            ("patentes", "Patentes e desenho industrial", r"patente|propriedade industrial|\binpi\b|desenho industrial|modelo de utilidade|9\.279"),
        ]),
        ("Arbitragem e mercado", [
            ("arbitragem", "Arbitragem", r"arbitragem|arbitral|clausula compromissoria|compromisso arbitral|9\.307"),
            ("mercado", "Mercado de capitais e concorrência", r"mercado de capitais|\bcvm\b|valores mobiliarios|\bcade\b|antitruste|ordem economica|bolsa de valores"),
        ]),
    ],
    "proc-civil": [
        ("Sujeitos do processo", [
            ("partes", "Legitimidade e interesse de agir", r"legitimidade|ilegitimidade|interesse de agir|interesse processual|substituicao processual|capacidade processual"),
            ("intervencao", "Litisconsórcio e intervenção de terceiros", r"litisconsorcio|intervencao de terceiros|denunciacao da lide|chamamento ao processo|assistencia simples|assistente litisconsorcial|amicus curiae|oposicao"),
            ("competencia", "Competência", r"competencia|conflito de competencia|\bforo\b|conexao|continencia|prevencao|clausula de eleicao"),
            ("honorarios", "Honorários advocatícios", r"honorarios|sucumbencia|verba honoraria|art\. 85"),
            ("gratuidade", "Gratuidade da justiça, custas e depósitos", r"custas|gratuidade|justica gratuita|assistencia judiciaria|depositos? (judicia|recursa)|despesas processuais|caucao"),
        ]),
        ("Atos processuais e tutelas", [
            ("atos-proc", "Citação, intimação, prazos e nulidades", r"citacao|intimacao|nulidade|revelia|prazos? processua|contagem (do|de) prazo|comunicacao dos atos|processo eletronico"),
            ("tutela", "Tutelas provisórias e efeito suspensivo", r"tutela (provisoria|de urgencia|antecipada|cautelar|de evidencia)|liminar|medida cautelar|efeito suspensivo"),
        ]),
        ("Conhecimento e sentença", [
            ("provas-pc", "Provas e ônus da prova", r"(?<!reexame de )(?<!reexame das )(?<!reexame do conjunto de )(?<!revolvimento de )(?<!revolvimento das )(?<!fatos e )(?<!fatos e de )(?<!fatos e das )\bprovas?\b|pericia|onus da prova|cerceamento de defesa|depoimento|testemunh|prova emprestada|julgamento antecipado"),
            ("fundamentacao", "Fundamentação e julgamento extra, ultra ou citra petita", r"julgamento (extra|ultra|citra) petita|sentenca (extra|ultra|citra) petita|nulidade da sentenca|fundamentacao (deficiente|genérica|generica)|ausencia de fundamentacao|art\. 489|principio da congruencia|adstricao"),
            ("coisa-julgada", "Coisa julgada, preclusão e ação rescisória", r"coisa julgada|acao rescisoria|querela nullitatis|preclusao|relativizacao"),
            ("especiais", "Procedimentos especiais", r"acao monitoria|monitori|embargos de terceiro|possessoria|acao de exigir contas|prestacao de contas|consignacao em pagamento|divisao e demarcacao|acao popular|restauracao de autos"),
            ("ms", "Mandado de segurança", r"mandado de seguranca|direito liquido e certo|autoridade coatora|habeas data|12\.016"),
            ("coletivo", "Processo coletivo e ação civil pública", r"acao civil publica|acao coletiva|direitos (difusos|coletivos|individuais homogeneos)|tutela coletiva|7\.347|legitimidade do ministerio publico"),
            ("arbitragem-pc", "Convenção de arbitragem e sentença arbitral", r"arbitragem|arbitral|clausula compromissoria|compromisso arbitral|9\.307"),
        ]),
        ("Execução", [
            ("cumprimento", "Cumprimento de sentença e liquidação", r"cumprimento (de|da) sentenca|liquidacao|impugnacao ao cumprimento|multa do art\. 523|astreintes|multa cominatoria|obrigacao de fazer"),
            ("execucao-tit", "Execução de título extrajudicial e embargos", r"execucao de titulo|titulos? executivos?|embargos a execucao|excecao de pre-executividade|execucao por quantia"),
            ("penhora", "Penhora, bloqueio e expropriação", r"penhora|arresto|bloqueio (de valores|judicial|de ativos)|sisbajud|bacenjud|expropria|leilao|arrematacao|adjudicacao"),
            ("bem-familia", "Bem de família e impenhorabilidade", r"bem de familia|impenhorab|8\.009|verba (salarial|alimentar)|40 salarios"),
            ("fraude-execucao", "Fraude à execução", r"fraude (a|de|contra) execucao|sumula 375|terceiro adquirente"),
            ("medidas-atipicas", "Medidas executivas atípicas", r"medidas (executivas )?atipicas|art\. 139, iv|suspensao (da|de) (cnh|carteira)|passaporte"),
            ("prescricao-int", "Prescrição intercorrente", r"prescricao intercorrente"),
        ]),
        ("Recurso especial: admissibilidade", [
            ("prequestionamento", "Prequestionamento", r"prequestion|sumulas? (n\. )?(211|282|356)|art\. 1\.025"),
            ("reexame", "Reexame de fatos, provas e cláusulas (Súmulas 5 e 7)", r"sumulas? (n\. )?(5|7)(\b|/)|reexame|revolvimento|conjunto fatico"),
            ("fundamentacao-recursal", "Deficiência das razões (Súmulas 283 e 284/STF)", r"sumulas? (n\. )?(283|284)|razoes recursais|deficiencia (na|da) fundamentacao|fundamento (autonomo|inatacado)|nao impugnacao (especifica )?(dos|de) fundamento"),
            ("dissidio", "Dissídio jurisprudencial e Súmula 83", r"dissidio|divergencia jurisprudencial|cotejo analitico|alinea c|sumula (n\. )?83"),
            ("materia-inadequada", "Matéria constitucional, lei local e atos infralegais", r"sumulas? (n\. )?(280|518|636)|lei local|direito local|materia constitucional|competencia do (stf|supremo)|resolucao|portaria|ato normativo infralegal"),
        ]),
        ("Agravos e embargos de declaração", [
            ("negativa-prestacao", "Negativa de prestação jurisdicional (arts. 489 e 1.022)", r"negativa de prestacao jurisdicional|omissao|contradicao|obscuridade|arts?\. 1\.022|arts?\. 489"),
            ("embargos-declaracao", "Embargos de declaração: cabimento e multa", r"embargos de declaracao|efeitos infringentes|protelatori|art\. 1\.026|prequestionamento ficto"),
            ("aresp", "Agravo em recurso especial e impugnação específica", r"sumula (n\. )?182|impugnacao especifica|art\. 1\.042|dialeticidade|combate a todos os fundamentos"),
            ("agravo-interno", "Agravo interno e multa", r"art\. 1\.021|manifestamente (improcedente|inadmissivel)|multa (do|prevista no) art\. 1\.021"),
            ("agravo-instrumento", "Agravo de instrumento e taxatividade", r"agravo de instrumento|taxatividade|art\. 1\.015"),
        ]),
        ("Recursos e precedentes", [
            ("apelacao", "Apelação e julgamento ampliado", r"apelacao|julgamento ampliado|art\. 942|tecnica de ampliacao|sustentacao oral|reformatio in pejus|efeito devolutivo"),
            ("preparo", "Preparo, tempestividade e representação processual", r"tempestividade|intempestiv|preparo|desercao|feriado local|prazo recursal|representacao processual|sumula (n\. )?115|substabelecimento"),
            ("precedentes-pc", "Precedentes, repetitivos e IRDR", r"recursos? especia(l|is) repetitiv|\birdr\b|incidente de resolucao|\biac\b|precedente qualificado|distinguishing|superacao de precedente|tema repetitivo"),
            ("eresp", "Embargos de divergência", r"embargos de divergencia"),
            ("reclamacao", "Reclamação", r"\breclamacao\b"),
        ]),
    ],
    "tributario": [
        ("Tributos federais", [
            ("ir", "Imposto de renda e CSLL", r"imposto (sobre a )?renda|\birpf\b|\birpj\b|\bcsll\b|lucro (real|presumido)|ganho de capital"),
            ("pis-cofins", "PIS e Cofins", r"\bpis\b|cofins|pasep|insumos?|nao cumulatividade"),
            ("contrib-prev", "Contribuições previdenciárias e de terceiros", r"contribuic\w* previdenciari|cota patronal|\brat\b|\bsat\b|terceiros|salario-educacao|\bincra\b|\bsesc\b|\bsenai\b|\bsebrae\b|seguridade social|folha de salarios"),
            ("ipi-iof", "IPI e IOF", r"\bipi\b|\biof\b"),
            ("aduaneiro", "Comércio exterior e tributos aduaneiros", r"importacao|exportacao|drawback|aduaneir|reintegra|imposto de importacao|pena de perdimento|desembaraco"),
            ("simples", "Simples Nacional", r"simples nacional|microempresa|empresa de pequeno porte|\bmei\b"),
        ]),
        ("Tributos estaduais", [
            ("icms", "ICMS", r"\bicms\b|difal|substituicao tributaria progressiva|credito de icms"),
            ("ipva-itcmd", "IPVA e ITCMD", r"\bipva\b|\bitcmd\b|\bitcd\b|causa mortis"),
        ]),
        ("Tributos municipais", [
            ("iss", "ISS", r"\biss\b|issqn"),
            ("iptu-itbi", "IPTU e ITBI", r"\biptu\b|\bitbi\b|taxa de coleta de lixo"),
            ("taxas", "Taxas e contribuições especiais", r"\btaxas?\b|contribuicao de melhoria|\bcide\b|contribuicao de iluminacao|\bcosip\b"),
        ]),
        ("Normas gerais", [
            ("imunidade", "Imunidades e isenções", r"imunidade|isencao|beneficio fiscal|incentivo fiscal|nao incidencia|aliquota zero"),
            ("credito-trib", "Lançamento, decadência e prescrição", r"credito tributario|lancamento|prescricao|decadencia|suspensao da exigibilidade"),
            ("parcelamento", "Parcelamento, transação e denúncia espontânea", r"parcelamento|refis|transacao tributaria|denuncia espontanea|programa de regularizacao"),
            ("responsabilidade-trib", "Responsabilidade tributária e redirecionamento", r"responsabilidade tributaria|redirecionamento|dissolucao irregular|sucessao empresarial|substituicao tributaria|solidariedade tributaria|art\. 135"),
            ("compensacao", "Compensação e repetição de indébito", r"compensacao|repeticao de indebito|restituicao|creditamento"),
            ("multas-trib", "Multas tributárias e Selic", r"multa (moratoria|punitiva|isolada|confiscatoria|de oficio)|taxa selic|juros de mora (tributarios|sobre tributo)"),
        ]),
        ("Processo tributário", [
            ("exec-fiscal", "Execução fiscal, exceção de pré-executividade e penhora", r"execucao fiscal|certidao de divida ativa|\bcda\b|embargos a execucao fiscal|6\.830|garantia do juizo|excecao de pre-executividade|sumula (n\. )?393|penhora|sisbajud|bloqueio de valores"),
            ("processo-trib", "Processo administrativo fiscal e certidões", r"processo administrativo fiscal|\bcarf\b|certidao (negativa|positiva)|\bcnd\b|arrolamento de bens"),
        ]),
    ],
    "administrativo": [
        ("Agentes públicos", [
            ("remuneracao", "Remuneração, vantagens e reajustes", r"remuneracao|vencimentos|gratificac|adicional|reajuste|teto remuneratorio|vantage(m|ns)|subsidio|abono|diferencas (salariais|remuneratorias)|\burv\b|piso salarial"),
            ("cargos", "Cargo, carreira, acumulação e licenças", r"cargo publico|acumulacao de cargos|licenca|enquadramento|progressao funcional|promocao|estabilidade|estagio probatorio|remocao|redistribuicao|desvio de funcao|jornada"),
            ("aposentadoria-serv", "Aposentadoria e pensão de servidores", r"aposentadoria|regime proprio|\brpps\b|paridade|integralidade|pensao por morte|abono de permanencia|contagem reciproca"),
            ("concursos", "Concursos públicos", r"concurso publico|edital|candidato|nomeacao|cadastro de reserva|teste de aptidao|heteroidentificacao|banca examinadora"),
            ("militares", "Militares", r"militar|militares|forcas armadas|policia militar|bombeiro|reforma militar|exercito|marinha do brasil|aeronautica"),
            ("pad", "Processo administrativo disciplinar", r"processo administrativo disciplinar|\bpad\b|demissao|sindicancia|poder disciplinar|penalidade disciplinar"),
            ("servidores", "Servidores públicos: outros temas", r"servidor|servidores|agente publico|funcionario publico"),
        ]),
        ("Controle da administração", [
            ("improbidade", "Improbidade administrativa", r"improbidade|8\.429|14\.230|enriquecimento ilicito do agente"),
            ("controle", "Atos administrativos, poder de polícia e sanções", r"poder de policia|atos? administrativ|anulacao do ato|autotutela|discricionari|sancao administrativa|multa administrativa|processo administrativo"),
            ("tribunal-contas", "Tribunais de contas", r"tribunal de contas|\btcu\b|\btce\b|tomada de contas"),
        ]),
        ("Contratações públicas", [
            ("licitacoes", "Licitações", r"licitac|pregao|14\.133|8\.666|dispensa de licitacao|inexigibilidade"),
            ("contratos-adm", "Contratos administrativos e equilíbrio econômico", r"contratos? administrativ|equilibrio economico|reequilibrio|reajuste contratual|contratada pela administracao"),
            ("concessoes", "Concessões, permissões e PPP", r"concessao (de servico|comum|patrocinada)|permissao de servico|parceria publico|\bppp\b|concessionaria de servico|pedagio"),
        ]),
        ("Bens públicos e intervenção", [
            ("desapropriacao", "Desapropriação e indenização", r"desapropria|indenizacao expropriatoria|juros compensatorios|justa indenizacao|valor ofertado|imissao provisoria"),
            ("bens-publicos", "Bens públicos, terrenos de marinha e tombamento", r"bens? publico|terreno de marinha|faixa de dominio|servidao administrativa|tombamento|ocupacao de area publica|laudemio|taxa de ocupacao"),
            ("urbanismo-adm", "Urbanismo e ordenação urbana", r"urbanistic|parcelamento do solo|loteamento|plano diretor|zoneamento|ocupacao irregular|construcao irregular|demolicao|regularizacao fundiaria|reurb|alvara"),
        ]),
        ("Fazenda Pública", [
            ("resp-estado", "Responsabilidade civil do Estado", r"responsabilidade (civil |objetiva )?do estado|responsabilidade (civil )?(do|da) (municipio|uniao|ente|poder publico|administracao)|37, ?§ ?6|omissao (estatal|do poder publico|do estado)|custodia do estado|morte de (preso|detento)"),
            ("prescricao-adm", "Prescrição contra a Fazenda e no processo administrativo", r"20\.910|prescricao quinquenal|fundo de direito|trato sucessivo|sumula 85|9\.873|prescricao intercorrente (no|em) processo administrativo"),
            ("fazenda-juizo", "Precatórios, juros e correção contra a Fazenda", r"precatorio|\brpv\b|requisicao de pequeno valor|fazenda publica em juizo|1-f da lei 9\.494|tema 810|emenda constitucional (n\. )?113|juros e correcao"),
        ]),
        ("Regulação e serviços públicos", [
            ("regulacao", "Agências reguladoras e serviços públicos", r"agencia reguladora|anatel|aneel|anvisa|\bans\b|antt|anac|saneamento|servicos? publicos?"),
            ("transito", "Trânsito, habilitação e multas", r"transito|\bcnh\b|detran|infracao de transito|habilitacao para dirigir|apreensao de veiculo|multa de transito|lei seca"),
            ("conselhos", "Conselhos profissionais", r"conselhos? (profissiona|de fiscalizacao|regional|federal)|\bcrm\b|\bcrea\b|\bcrf\b|anuidade|exercicio profissional"),
        ]),
        ("Direitos sociais", [
            ("saude-pub", "Saúde pública e medicamentos", r"medicamento|\bsus\b|tratamento medico|internacao|fornecimento de (remedio|medicamento)"),
            ("ensino-pub", "Ensino público e financiamento estudantil", r"ensino|educacao|universidade|instituicao federal de ensino|\bfies\b|\benem\b|vaga em creche"),
            ("fgts", "FGTS", r"\bfgts\b|fundo de garantia"),
        ]),
    ],
    "previdenciario": [
        ("Aposentadorias", [
            ("tempo-especial", "Tempo especial e agentes nocivos", r"tempo especial|atividade especial|agentes? nocivos?|\bppp\b|ruido|insalubr|conversao de tempo|vigilante"),
            ("aposentadorias", "Aposentadorias: requisitos e regras de transição", r"aposentadoria|tempo de contribuicao|idade minima|pedagio|regra de transicao|carencia"),
        ]),
        ("Outros benefícios", [
            ("incapacidade", "Benefícios por incapacidade", r"auxilio-doenca|auxilio por incapacidade|aposentadoria por invalidez|incapacidade|pericia medica|reabilitacao"),
            ("pensao-morte", "Pensão por morte e qualidade de segurado", r"pensao por morte|dependente|qualidade de segurado|periodo de graca"),
            ("assistencial", "Benefício assistencial (BPC/LOAS)", r"\bbpc\b|\bloas\b|amparo assistencial|beneficio assistencial|miserabilidade|renda per capita"),
            ("outros-benef", "Salário-maternidade, auxílio-reclusão e auxílio-acidente", r"salario-maternidade|auxilio-reclusao|salario-familia|auxilio-acidente"),
        ]),
        ("Segurados", [
            ("rural", "Trabalhador rural e segurado especial", r"rural|segurado especial|boia-fria|inicio de prova material"),
            ("acidentaria", "Acidente de trabalho e ação regressiva do INSS", r"acidente (do|de) trabalho|acidentari|doenca ocupacional|acao regressiva"),
        ]),
        ("Cálculo, revisão e devolução", [
            ("revisao", "Revisão e cálculo de benefícios", r"revisao|renda mensal|salario de beneficio|salario de contribuicao|fator previdenciario|vida toda|decadencia|desaposentacao|reafirmacao da der|teto"),
            ("devolucao", "Devolução de valores e descontos", r"devolucao de valores|valores recebidos|boa-fe|desconto (em|no) beneficio|tutela antecipada revogada"),
        ]),
        ("Previdência complementar", [
            ("privada", "Previdência privada", r"previdencia (privada|complementar)|entidade (fechada|aberta)|resgate de reserva|plano de beneficios|patrocinador"),
        ]),
    ],
    "ambiental": [
        ("Responsabilidade ambiental", [
            ("dano-amb", "Dano ambiental e reparação", r"dano ambiental|reparacao|recuperacao ambiental|poluicao|degradacao|responsabilidade (civil )?ambiental|propter rem|poluidor|risco integral"),
        ]),
        ("Espaços protegidos", [
            ("areas-prot", "APP, reserva legal e Código Florestal", r"preservacao permanente|\bapp\b|reserva legal|codigo florestal|12\.651|mata atlantica|limitacao administrativa|interesse ecologico|area de protecao ambiental|\bapa\b"),
            ("unidades-conservacao", "Unidades de conservação", r"unidade de conservacao|parque (nacional|estadual)|\bsnuc\b|9\.985"),
        ]),
        ("Recursos naturais", [
            ("recursos-nat", "Recursos hídricos, mineração e resíduos", r"recursos hidricos|mineracao|minerar|lavra|garimpo|residuos|aterro|saneamento|chorume|efluente|esgoto"),
            ("fauna", "Fauna, flora e pesca", r"fauna|animais silvestres|\bpesca\b|\bcaca\b|flora|desmatamento"),
        ]),
        ("Licenciamento e infrações", [
            ("sancoes-amb", "Licenciamento, infrações e multas ambientais", r"multa|infracao|auto de infracao|licenciamento|licenca ambiental|ibama"),
            ("urbanistico", "Urbanismo, ocupação do solo e poluição visual", r"urbanistic|parcelamento do solo|loteamento|plano diretor|zoneamento|ocupacao irregular|construcao irregular|demolicao|drenagem|poluicao visual|painel|regularizacao fundiaria"),
        ]),
    ],
    "penal": [
        ("Aplicação da pena", [
            ("dosimetria", "Dosimetria: pena-base, agravantes e causas de aumento", r"dosimetria|pena-base|circunstancias judiciais|agravante|atenuante|reincidencia|maus antecedentes|confissao espontanea|majorante|minorante|causa de (aumento|diminuicao)|continuidade delitiva|concurso (material|formal)"),
            ("regime", "Regime inicial e substituição da pena", r"regime (inicial|prisional|semiaberto|fechado|aberto|mais gravoso)|substituicao da pena|restritivas? de direitos|\bsursis\b|detracao"),
        ]),
        ("Punibilidade e tipicidade", [
            ("prescricao-penal", "Prescrição penal", r"prescricao|prescricional"),
            ("insignificancia", "Insignificância, atipicidade e crime impossível", r"insignificancia|bagatela|atipicidade|crime impossivel|intervencao minima"),
            ("punibilidade", "Outras causas de extinção da punibilidade", r"extincao da punibilidade|perdao judicial|decadencia do direito de queixa|renuncia|reparacao do dano|abolitio"),
        ]),
        ("Execução penal", [
            ("progressao", "Progressão, livramento e faltas", r"progressao|livramento condicional|falta grave|regressao|saida temporaria|trabalho externo|exame criminologico"),
            ("remicao-indulto", "Remição, indulto e unificação de penas", r"remicao|indulto|comutacao|unificacao de penas|soma de penas"),
            ("exec-penal", "Execução penal: outros temas", r"execucao penal|7\.210|juizo da execucao|prisao domiciliar humanitaria"),
        ]),
        ("Crimes contra a pessoa", [
            ("pessoa", "Crimes contra a vida e lesões corporais", r"homicidio|lesao corporal|feminicidio|aborto|infanticidio|induzimento"),
            ("violencia-dom", "Violência doméstica e familiar", r"violencia domestica|maria da penha|11\.340|medidas protetivas|ambito domestico"),
            ("sexuais", "Crimes sexuais", r"estupro|dignidade sexual|vulneravel|pornografia|importunacao|assedio sexual"),
            ("honra", "Crimes contra a honra", r"injuria|calunia|difamacao"),
            ("liberdade", "Ameaça, perseguição e crimes contra a liberdade", r"(?<!grave )(?<!violencia ou )ameaca|perseguicao|stalking|sequestro|carcere privado|condicao analoga|art\. 147"),
        ]),
        ("Crimes contra o patrimônio", [
            ("furto", "Furto", r"furto"),
            ("roubo", "Roubo, extorsão e latrocínio", r"roubo|extorsao|latrocinio"),
            ("estelionato", "Estelionato, receptação e apropriação indébita", r"estelionato|receptacao|fraude eletronica|apropriacao indebita(?! (tributaria|previdenciaria))|dano qualificado"),
        ]),
        ("Drogas", [
            ("drogas", "Tráfico e associação para o tráfico", r"trafico|drogas|entorpecente|11\.343|associacao para o trafico"),
            ("trafico-privilegiado", "Tráfico privilegiado", r"trafico privilegiado|33, ?§ ?4|minorante do trafico|dedicacao a atividades criminosas"),
            ("porte-uso", "Porte para uso e distinção entre usuário e traficante", r"porte (de droga )?para (uso|consumo)|consumo proprio|usuario|art\. 28"),
        ]),
        ("Legislação especial", [
            ("armas", "Armas e munições", r"arma de fogo|municao|10\.826|desarmamento"),
            ("transito-penal", "Crimes de trânsito", r"crimes? de transito|embriaguez ao volante|9\.503|na direcao de veiculo|art\. 306|art\. 302"),
            ("ambientais-penal", "Crimes ambientais", r"crimes? ambienta|9\.605"),
            ("orcrim", "Organização e associação criminosa", r"organizacao criminosa|12\.850|associacao criminosa|milicia"),
        ]),
        ("Administração pública e crimes econômicos", [
            ("administracao", "Crimes contra a administração pública", r"peculato|corrupcao|concussao|prevaricacao|desacato|fraude (em|a) licitac|crimes? contra a administracao|contrabando|descaminho"),
            ("economicos", "Crimes tributários, financeiros e lavagem", r"lavagem|sonegacao|crimes? (tributari|contra a ordem tributaria)|8\.137|apropriacao indebita (tributaria|previdenciaria)|evasao de divisas|sistema financeiro nacional|7\.492"),
        ]),
    ],
    "proc-penal": [
        ("Investigação e ação penal", [
            ("acao-penal", "Inquérito, denúncia, justa causa e trancamento", r"denuncia|queixa|acao penal|inepcia|justa causa|trancamento|inquerito policial|investigacao"),
            ("acordos", "ANPP, transação e colaboração premiada", r"\banpp\b|acordo de nao persecucao|transacao penal|suspensao condicional do processo|colaboracao premiada|delacao"),
            ("competencia-pp", "Competência", r"competencia|conflito de competencia|justica (federal|estadual|militar|eleitoral)|foro por prerrogativa"),
        ]),
        ("Prisão e medidas cautelares", [
            ("preventiva", "Prisão preventiva: fundamentos", r"prisao preventiva|garantia da ordem publica|custodia cautelar|gravidade concreta|risco de reiteracao|periculosidade|segregacao cautelar"),
            ("excesso-prazo", "Excesso de prazo", r"excesso de prazo|razoavel duracao"),
            ("domiciliar", "Prisão domiciliar e cautelares alternativas", r"prisao domiciliar|medidas? cautelares? (diversas|alternativas)|monitoramento eletronico|filhos? menor|gestante|art\. 318"),
            ("flagrante", "Flagrante, audiência de custódia e fiança", r"prisao em flagrante|audiencia de custodia|\bfianca\b|liberdade provisoria"),
        ]),
        ("Provas", [
            ("busca", "Busca pessoal, veicular e domiciliar", r"busca (pessoal|domiciliar|veicular)|ingresso (em|no) domicilio|fundada suspeita|inviolabilidade (do|de) domicilio|entrada (em|no) domicilio|abordagem policial|invasao de domicilio"),
            ("interceptacao", "Interceptação, quebra de sigilo e dados digitais", r"interceptacao|quebra de sigilo|dados telematicos|celular|aparelho telefonico|whatsapp|extracao de dados|geolocalizacao|\bcoaf\b|\buif\b|relatorios? de inteligencia"),
            ("cadeia-custodia", "Cadeia de custódia, perícia e laudos", r"cadeia de custodia|\blaudo|pericia|exame de corpo de delito"),
            ("reconhecimento", "Reconhecimento de pessoas", r"reconhecimento (pessoal|fotografico|de pessoas)|art\. 226"),
            ("provas-pp", "Provas em geral e prova ilícita", r"\bprovas?\b|ilicit|confissao informal|depoimento (de|dos) policia"),
        ]),
        ("Procedimento e nulidades", [
            ("defesa", "Defesa técnica, interrogatório e contraditório", r"defesa tecnica|defensor|interrogatorio|autodefesa|ampla defesa|cerceamento de defesa|contraditorio"),
            ("correlacao", "Correlação entre acusação e sentença", r"emendatio|mutatio|correlacao|congruencia"),
            ("sentenca-pp", "Absolvição, in dubio pro reo e desclassificação", r"absolvicao|absolvido|in dubio pro reo|insuficiencia (de provas|probatoria)|desclassificacao"),
            ("nulidades-pp", "Nulidades: outros temas", r"nulidade|citacao|intimacao"),
        ]),
        ("Tribunal do Júri", [
            ("pronuncia", "Pronúncia e impronúncia", r"pronuncia|impronuncia|in dubio pro societate|qualificadoras? na pronuncia"),
            ("juri", "Júri: plenário, quesitos e soberania dos veredictos", r"\bjuri\b|quesit|conselho de sentenca|plenario|soberania dos veredictos|manifestamente contraria"),
        ]),
        ("Habeas corpus e recursos", [
            ("hc", "Habeas corpus: cabimento", r"habeas corpus|writ|ordem de oficio|constrangimento ilegal|substitutivo|sucedaneo|impetracao|exaurimento|supressao de instancia"),
            ("recursos-pp", "Recursos criminais e revisão criminal", r"revisao criminal|recurso em sentido estrito|apelacao criminal|embargos infringentes|recurso especial criminal"),
            ("admissibilidade-pp", "Admissibilidade do recurso especial e do agravo", r"sumulas? (n\. )?(7|83|115|182|211|283|284|356)(\b|/)|dialeticidade|impugnacao especifica|intempestiv|reexame|revolvimento|prequestion|representacao processual"),
            ("embargos-pp", "Embargos de declaração", r"embargos de declaracao|omissao|contradicao|obscuridade|art\. 619"),
        ]),
    ],
    "trabalho": [],
}

# Assuntos amplos: no selo do julgado só entram quando nenhum mais específico da mesma matéria se aplica.
GENERICOS = {
    "contratos", "obrigacoes", "resp-civil", "prescricao-civ", "negocio-juridico", "seguros", "planos-saude", "praticas", "defesa-cons",
    "contratos-banc", "juros", "atos-proc", "provas-pc", "competencia", "partes", "servidores", "controle", "credito-trib", "revisao",
    "dano-amb", "provas-pp", "nulidades-pp", "acao-penal", "dosimetria", "punibilidade", "exec-penal", "sociedades", "competencia-pp",
    "drogas", "hc", "aposentadorias", "remuneracao", "sancoes-amb",
    # Admissibilidade e recursos: úteis como filtro, mas não tomam o lugar do assunto de mérito.
    "prequestionamento", "reexame", "fundamentacao-recursal", "dissidio", "materia-inadequada", "negativa-prestacao",
    "embargos-declaracao", "aresp", "agravo-interno", "preparo", "admissibilidade-pp", "embargos-pp",
}


def achatar():
    """Formato usado pelo atualizar.py: {matéria: [(chave, rótulo, grupo, expressão), ...]}."""
    return {a: [(k, rot, g, rx) for g, lst in grupos for k, rot, rx in lst] for a, grupos in ASSUNTOS.items()}
