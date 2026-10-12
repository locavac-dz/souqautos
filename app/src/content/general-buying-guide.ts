// Lot 144 — le guide d'achat GÉNÉRAL : « Acheter une voiture d'occasion, étape par étape ». Le seul guide livré avec le site : il ne
// dépend d'aucun modèle, donc il sert pour toute annonce (elle le propose quand son modèle n'a pas de guide propre).
//
// CE TEXTE EST UN BROUILLON À RELIRE, il n'est JAMAIS publié tout seul (`npm run content:guide-general` le crée en brouillon).
// Il ne contient que des conseils généraux, vérifiables par n'importe quel acheteur. Volontairement ABSENT, faute de pouvoir le
// garantir : toute règle administrative ou juridique algérienne précise (nom des pièces, services, délais, montants). Les démarches y
// sont renvoyées à « l'administration compétente », et un avertissement le dit en tête. À relire avant publication :
//  - par la personne qui connaît les démarches actuelles (mention de l'acte de vente, du changement de titulaire, du gage) ;
//  - par un locuteur natif pour la version arabe.
// Les deux versions sont construites point par point (mêmes sections, mêmes listes) : tests/general-buying-guide.test.ts le garde.

export const GENERAL_GUIDE_SLUG_BASE = "Acheter une voiture d'occasion : le guide complet, étape par étape";

const checklistFr = [
  "Le nom du vendeur est celui de la carte grise, et le numéro de série (châssis) du document est identique à celui gravé sur le véhicule.",
  "Le vendeur accepte de vous montrer le véhicule en personne avant tout paiement : jamais d'acompte à distance.",
  "Le kilométrage affiché est cohérent avec l'usure des pneus, des pédales, du volant et du siège conducteur.",
  "Carnet d'entretien et factures : des révisions régulières, avec des dates et des kilométrages qui se suivent.",
  "Le contrôle technique et l'assurance sont à jour, si le véhicule y est soumis.",
  "Aucun gage ni saisie sur le véhicule : demandez-le clairement au vendeur et faites-le vérifier auprès des services compétents.",
  "Carrosserie : écarts irréguliers entre les panneaux, peinture de teinte différente, rouille, traces de choc.",
  "Sous le capot et sous la voiture : aucune fuite, huile de couleur normale, pas de fumée anormale à froid.",
  "Pneus usés régulièrement, freins efficaces, direction droite : un défaut peut cacher un choc ou un entretien négligé.",
  "Essai routier d'au moins 20 minutes, moteur froid au départ : bruits, vibrations, boîte, embrayage, freinage.",
  "Le prix est cohérent avec des annonces comparables ; un prix très inférieur au marché est un signal d'alerte, pas une aubaine.",
  "Faites examiner le véhicule par un mécanicien de confiance avant de vous engager.",
];

const checklistAr = [
  "اسم البائع هو المكتوب في البطاقة الرمادية، ورقم الهيكل (رقم التسلسل) في الوثيقة مطابق للرقم المحفور على السيارة.",
  "يقبل البائع أن يريك السيارة شخصيًا قبل أي دفعة: لا تدفع عربونًا عن بُعد أبدًا.",
  "المسافة المقطوعة المعروضة تتوافق مع تآكل العجلات والدواسات والمقود ومقعد السائق.",
  "دفتر الصيانة والفواتير: صيانة منتظمة بتواريخ ومسافات متسلسلة.",
  "المراقبة التقنية والتأمين ساريان، إن كانت السيارة خاضعة لهما.",
  "لا رهن ولا حجز على السيارة: اسأل البائع عن ذلك بوضوح وتحقّق منه لدى الجهات المختصة.",
  "الهيكل الخارجي: فراغات غير متساوية بين الأجزاء، طلاء بدرجة لون مختلفة، صدأ، آثار صدمات.",
  "تحت غطاء المحرك وتحت السيارة: لا تسرّبات، زيت بلون عادي، ولا دخان غير طبيعي عند التشغيل على البارد.",
  "العجلات متآكلة بانتظام، والمكابح فعّالة، والمقود مستقيم: أي عيب قد يخفي صدمة أو صيانة مهملة.",
  "تجربة قيادة لا تقل عن 20 دقيقة والمحرك بارد عند الانطلاق: أصوات، اهتزازات، علبة السرعة، القابض، الكبح.",
  "السعر معقول مقارنة بإعلانات مماثلة؛ السعر الأقل بكثير من السوق إشارة تحذير وليس فرصة.",
  "اطلب من ميكانيكي تثق به فحص السيارة قبل أن تلتزم.",
];

const contentFr = `Acheter une voiture d'occasion, c'est acheter un historique que l'on ne voit pas. Ce guide vous donne, étape par étape, les vérifications qui protègent le plus, de la lecture de l'annonce jusqu'à la signature. Il vaut pour toutes les marques et tous les modèles.

> Ce guide donne des conseils généraux. Les règles et les démarches administratives évoluent : avant de conclure, renseignez-vous auprès de l'administration compétente ou d'un professionnel. Il ne remplace ni un avis juridique ni l'examen du véhicule par un mécanicien.

## 1. Avant de contacter le vendeur

- **Calculez votre budget total**, pas seulement le prix affiché : assurance, changement de titulaire de la carte grise, entretien à prévoir (pneus, freins, vidange, courroie de distribution) et une réserve pour les imprévus.
- **Comparez avant de choisir.** Regardez plusieurs annonces du même modèle, du même âge et du même kilométrage. La [Cote Souq Autos](/fr/cote-souq-auto) et le [comparateur](/fr/comparateur) vous aident à situer un prix.
- **Lisez l'annonce comme un enquêteur.** Plusieurs photos nettes (extérieur, intérieur, compteur, moteur) sont bon signe. Une description vide, des photos floues ou prises d'un seul angle, ou un texte identique à celui d'une autre annonce doivent vous faire douter.
- **Regardez le vendeur.** Sur Souq Autos, « Identité vérifiée » signifie que l'équipe du site a contrôlé une pièce d'identité ; « Répond en moins de… » est calculé à partir des messages échangés sur le site. Ce sont des repères, pas des garanties.
- **Méfiez-vous du prix trop beau.** Le repère « Très bonne affaire » signale un prix nettement inférieur aux annonces comparables : ce peut être une vraie occasion, ou une annonce à vérifier avec le plus grand soin.

## 2. Le premier échange

Posez des questions précises avant de vous déplacer. Les réponses, et les hésitations, en disent long :

- Pourquoi vend-il, et depuis combien de temps possède-t-il le véhicule ?
- Combien de propriétaires avant lui ?
- A-t-il le carnet d'entretien et les factures ? Quand a eu lieu la dernière révision ?
- Le véhicule a-t-il eu un accident, une réparation de carrosserie, un changement de moteur ou de boîte ?
- Le kilométrage est-il d'origine ?
- Les papiers sont-ils à son nom, et le véhicule est-il libre de tout gage ?

Restez sur la messagerie du site tant que vous n'êtes pas rassuré : elle garde une trace de l'échange.

### Les signes qui doivent vous alerter

- Un prix nettement inférieur au marché, sans explication.
- Un vendeur qui réclame de l'argent avant que vous ayez vu le véhicule, ou un « acompte pour bloquer la voiture ».
- Un refus de vous rencontrer, de montrer les papiers ou de laisser un mécanicien examiner le véhicule.
- Une histoire compliquée : vendeur à l'étranger, véhicule « en transit » ou « sous douane », intermédiaire injoignable.
- La pression : « d'autres acheteurs sont prêts, décidez aujourd'hui ».
- Une demande de code reçu par SMS, de lien à ouvrir ou de paiement à une tierce personne.

Si une annonce vous paraît suspecte, utilisez « Signaler cette annonce » : elle est examinée par l'équipe.

## 3. Vérifier les papiers

- **La carte grise.** Le nom du vendeur correspond à sa pièce d'identité ; la marque, le modèle, la couleur et l'énergie correspondent au véhicule ; le numéro de série (châssis) inscrit sur le document est identique à celui gravé sur le véhicule, à l'endroit indiqué par le constructeur.
- **Le contrôle technique**, si le véhicule y est soumis : date de validité et observations du contrôleur (points à réparer).
- **L'absence de gage ou de saisie.** Demandez au vendeur de le justifier, et faites-le vérifier auprès des services compétents avant de payer.
- **L'historique.** Carnet d'entretien, factures, éventuels rapports d'expertise : des dates et des kilométrages qui se suivent sont bon signe.
- **Un vendeur qui n'est pas le titulaire.** Un proche, un intermédiaire ou un revendeur peut vendre, mais exigez la preuve claire de son droit de vendre, et méfiez-vous si le titulaire reste introuvable.

## 4. Inspecter le véhicule

Voyez la voiture de jour, sur sol sec, moteur froid. Prenez votre temps, et une lampe de poche.

### Carrosserie et structure

- Faites le tour en observant les reflets : des ondulations révèlent une réparation.
- Les écarts entre portières, capot, ailes et coffre doivent être réguliers.
- Cherchez une teinte légèrement différente d'un panneau à l'autre, de la peinture sur les joints ou les caoutchoucs, de la rouille (bas de portes, passages de roues, plancher).
- Regardez la marque et la date gravées sur les vitres : des vitres de dates différentes peuvent indiquer un remplacement après un choc.

### Sous le capot et sous la voiture

- Huile moteur : une huile très noire et épaisse, ou d'aspect laiteux, est un mauvais signe.
- Cherchez des fuites (huile, liquide de refroidissement) sur le moteur et sur le sol, des courroies craquelées, une batterie très oxydée.
- Au démarrage à froid, surveillez la fumée : bleue (huile), blanche persistante (liquide de refroidissement) ou noire épaisse (mauvaise combustion) méritent une explication.

### Pneus, freins et direction

- Les pneus doivent être usés de façon régulière : une usure d'un seul côté trahit un défaut de géométrie, parfois un choc.
- Vérifiez leur âge (le code inscrit sur le flanc) et leur état (fissures, hernies).
- Volant droit en ligne droite, pas de jeu excessif, pédale de frein ferme.

### Intérieur et équipements

- L'usure doit correspondre au kilométrage : un volant lisse, des pédales usées et un siège affaissé sur une voiture « à faible kilométrage » sont suspects.
- Une odeur d'humidité, un tapis mouillé ou de la rouille sous les sièges peuvent révéler une fuite ou une inondation.
- Testez tout : vitres, verrouillage, climatisation, chauffage, feux, essuie-glaces, ceintures.
- Au contact, tous les voyants du tableau de bord doivent s'allumer puis s'éteindre. Un voyant qui ne s'allume jamais peut avoir été neutralisé.

### Selon l'énergie

- **GPL** : vérifiez que l'installation est en règle, sur les papiers comme sur le véhicule, et demandez la date de pose et, le cas échéant, celle de son dernier contrôle.
- **Hybride et électrique** : demandez l'état de santé de la batterie de traction et la garantie qui reste ; c'est le composant le plus coûteux.
- **Boîte automatique** : les passages de rapports doivent être doux, sans à-coups ni patinage.

## 5. L'essai routier

Prévoyez 20 à 30 minutes au moins, sur un parcours varié : ville, route, côte, ligne droite. Avant de partir, demandez si l'assurance du véhicule couvre l'essai, et gardez le vendeur à côté de vous.

- Coupez la radio et écoutez : cliquetis, grondements, sifflements, bruits de suspension sur les bosses.
- Le véhicule freine droit, sans vibrer ni tirer d'un côté, et sans que la pédale s'enfonce.
- La direction ne tire pas d'un côté et le volant ne vibre pas.
- L'embrayage embraye franchement, sans patiner ; la boîte passe les rapports sans craquer.
- L'aiguille de température reste stable, et aucun voyant ne s'allume.
- Après l'essai, laissez tourner le moteur, puis regardez sous le capot et sous la voiture : une odeur de brûlé, une fuite fraîche ou de la fumée sont des signaux à ne pas ignorer.

## 6. Faire examiner par un professionnel

Si vous hésitez, ou si la somme est importante, faites examiner le véhicule par un mécanicien de confiance, **que vous choisissez vous-même** (pas celui que le vendeur vous recommande). Un diagnostic électronique peut révéler des défauts enregistrés que l'œil ne voit pas. Un vendeur honnête n'a rien à craindre d'un contrôle : un refus est déjà une réponse.

## 7. Négocier

- Appuyez-vous sur des faits : usure constatée, travaux à prévoir (demandez un devis approximatif), prix d'annonces comparables.
- N'annoncez pas votre budget maximum, et ne négociez pas avant d'avoir tout vérifié : papiers, inspection, essai.
- Restez calme et prêt à partir : une bonne affaire ne disparaît pas parce que vous prenez un jour pour réfléchir.
- Faites confirmer par écrit ce qui a été promis : réparation à la charge du vendeur, accessoires inclus, double des clés.

## 8. Conclure en sécurité

- Retrouvez le vendeur dans un lieu fréquenté, de jour, et venez accompagné si possible.
- Ne payez rien avant d'avoir vu le véhicule, vérifié les papiers et convenu de tout.
- Privilégiez un paiement traçable et exigez un reçu écrit indiquant le montant, la date, le véhicule (numéro de série) et l'identité des deux parties. Évitez de transporter de grosses sommes en espèces.
- Faites établir l'acte de vente selon les règles en vigueur, **au prix réellement payé** : un prix minoré sur le papier vous prive de recours et peut avoir des conséquences légales.
- Faites enregistrer le changement de titulaire de la carte grise à votre nom, dans les délais et selon la procédure de l'administration compétente : tant qu'il n'est pas fait, le vendeur reste le titulaire officiel.
- Assurez le véhicule à votre nom avant de le conduire.
- Conservez tous les documents : acte, reçu, carnet, factures et échanges de messages.

## 9. Après l'achat

Faites contrôler et entretenir le véhicule sans attendre : vidange et filtres, freins, pneus, et courroie de distribution si son remplacement n'est pas documenté. Notez la date d'achat et le kilométrage, ils serviront de point de départ à votre suivi.

Pour être prévenu des nouvelles annonces qui correspondent à votre recherche, créez une alerte depuis votre compte.`;

const contentAr = `شراء سيارة مستعملة يعني شراء تاريخ لا تراه. يقدّم لك هذا الدليل، خطوة بخطوة، أهم عمليات التحقق التي تحميك، من قراءة الإعلان حتى التوقيع. وهو صالح لجميع العلامات والطرازات.

> يقدّم هذا الدليل نصائح عامة. القواعد والإجراءات الإدارية تتغيّر: قبل إتمام الصفقة، استعلم لدى الإدارة المختصة أو لدى مختص. وهو لا يغني عن استشارة قانونية ولا عن فحص السيارة عند ميكانيكي.

## 1. قبل التواصل مع البائع

- **احسب ميزانيتك الإجمالية** وليس السعر المعروض فقط: التأمين، وتغيير صاحب البطاقة الرمادية، والصيانة المنتظرة (العجلات، المكابح، تغيير الزيت، سير التوقيت)، واحتياطي للطوارئ.
- **قارن قبل أن تختار.** اطّلع على عدة إعلانات لنفس الطراز ونفس العمر ونفس المسافة المقطوعة. يساعدك [تقييم سوق أوتو](/ar/cote-souq-auto) و[المقارنة](/ar/comparateur) على وضع السعر في سياقه.
- **اقرأ الإعلان بعين المحقّق.** عدة صور واضحة (الخارج، الداخل، العدّاد، المحرك) علامة جيدة. أما الوصف الفارغ أو الصور الضبابية أو المأخوذة من زاوية واحدة أو النص المطابق لإعلان آخر فتدعو إلى الشك.
- **انظر إلى البائع.** في سوق أوتو، تعني «هوية موثّقة» أن فريق الموقع تحقّق من وثيقة هوية؛ وتُحسب عبارة «يرد في أقل من…» من الرسائل المتبادلة على الموقع. هذه مؤشرات وليست ضمانات.
- **احذر السعر الجميل أكثر من اللازم.** تشير عبارة «صفقة ممتازة» إلى سعر أقل بوضوح من الإعلانات المماثلة: قد تكون فرصة حقيقية، وقد تكون إعلانًا يجب التدقيق فيه بأقصى عناية.

## 2. أول تواصل

اطرح أسئلة دقيقة قبل أن تتنقّل. الإجابات، وكذلك التردّد، تقول الكثير:

- لماذا يبيع، ومنذ متى يملك السيارة؟
- كم مالكًا سبقه؟
- هل لديه دفتر الصيانة والفواتير؟ ومتى كانت آخر صيانة دورية؟
- هل تعرّضت السيارة لحادث أو إصلاح هيكل أو تغيير محرك أو علبة سرعة؟
- هل المسافة المقطوعة أصلية؟
- هل الوثائق باسمه، وهل السيارة خالية من أي رهن؟

ابقَ على رسائل الموقع ما دمت لم تطمئن: فهي تحتفظ بأثر للمحادثة.

### العلامات التي يجب أن تنبّهك

- سعر أقل بوضوح من السوق دون أي تفسير.
- بائع يطلب مالًا قبل أن ترى السيارة، أو «عربونًا لحجز السيارة».
- رفض لقائك، أو عرض الوثائق، أو السماح لميكانيكي بفحص السيارة.
- قصة معقّدة: بائع في الخارج، أو سيارة «في العبور» أو «لدى الجمارك»، أو وسيط لا يمكن الوصول إليه.
- الضغط: «هناك مشترون آخرون جاهزون، قرّر اليوم».
- طلب رمز وصلك برسالة نصية، أو رابط لفتحه، أو دفع مبلغ لشخص ثالث.

إذا بدا لك إعلان مشبوهًا، فاستعمل «الإبلاغ عن هذا الإعلان»: يفحصه الفريق.

## 3. التحقق من الوثائق

- **البطاقة الرمادية.** اسم البائع مطابق لوثيقة هويته؛ والعلامة والطراز واللون ونوع الطاقة مطابقة للسيارة؛ ورقم الهيكل (رقم التسلسل) المكتوب في الوثيقة مطابق للرقم المحفور على السيارة، في المكان الذي تحدده الشركة المصنّعة.
- **المراقبة التقنية**، إن كانت السيارة خاضعة لها: تاريخ الصلاحية وملاحظات المراقب (النقاط الواجب إصلاحها).
- **خلوّ السيارة من الرهن أو الحجز.** اطلب من البائع إثبات ذلك، وتحقّق منه لدى الجهات المختصة قبل الدفع.
- **السجل.** دفتر الصيانة والفواتير وأي تقارير خبرة: تواريخ ومسافات متسلسلة علامة جيدة.
- **بائع ليس هو صاحب السيارة.** يمكن لقريب أو وسيط أو تاجر أن يبيع، لكن اطلب دليلًا واضحًا على حقّه في البيع، واحذر إذا تعذّر الوصول إلى صاحب السيارة.

## 4. فحص السيارة

عاين السيارة نهارًا، على أرض جافة، والمحرك بارد. خذ وقتك، ومعك مصباح يدوي.

### الهيكل الخارجي والبنية

- دُر حول السيارة وراقب الانعكاسات: التموّجات تكشف إصلاحًا.
- يجب أن تكون الفراغات بين الأبواب والغطاء والأجنحة والصندوق منتظمة.
- ابحث عن درجة لون مختلفة قليلًا بين جزء وآخر، أو عن طلاء على الحشوات والمطاط، أو عن صدأ (أسفل الأبواب، مكان العجلات، الأرضية).
- انظر إلى العلامة والتاريخ المحفورين على الزجاج: اختلاف تواريخ الزجاج قد يدل على استبداله بعد صدمة.

### تحت غطاء المحرك وتحت السيارة

- زيت المحرك: الزيت الأسود الكثيف جدًا، أو الذي يبدو حليبيًا، علامة سيئة.
- ابحث عن تسرّبات (زيت، سائل التبريد) على المحرك وعلى الأرض، وعن سيور متشققة، وعن بطارية متأكسدة كثيرًا.
- عند التشغيل على البارد راقب الدخان: الأزرق (زيت)، أو الأبيض المستمر (سائل التبريد)، أو الأسود الكثيف (احتراق سيئ) يستحق تفسيرًا.

### العجلات والمكابح والمقود

- يجب أن تتآكل العجلات بانتظام: التآكل من جهة واحدة يدل على خلل في الضبط، وأحيانًا على صدمة.
- تحقّق من عمرها (الرمز المكتوب على الجانب) وحالتها (تشققات، انتفاخات).
- مقود مستقيم في الطريق المستقيم، دون خلوص مفرط، وبدالة مكبح صلبة.

### الداخل والتجهيزات

- يجب أن يتوافق التآكل مع المسافة المقطوعة: مقود أملس ودواسات متآكلة ومقعد متهالك في سيارة «قليلة المسافة» أمر مريب.
- رائحة رطوبة أو سجادة مبللة أو صدأ تحت المقاعد قد تكشف تسرّبًا أو غرقًا.
- جرّب كل شيء: النوافذ، والقفل، والمكيّف، والتدفئة، والأضواء، ومساحات الزجاج، وأحزمة الأمان.
- عند تشغيل الكونتاكت، يجب أن تضيء جميع مصابيح لوحة القيادة ثم تنطفئ. المصباح الذي لا يضيء أبدًا قد يكون عُطّل عمدًا.

### بحسب نوع الطاقة

- **غاز البترول المسال**: تحقّق من أن التركيب مطابق للقواعد، في الوثائق وعلى السيارة، واسأل عن تاريخ التركيب وعند الاقتضاء تاريخ آخر مراقبة له.
- **الهجينة والكهربائية**: اسأل عن حالة بطارية الدفع والضمان المتبقي؛ فهي أغلى مكوّن.
- **علبة السرعة الأوتوماتيكية**: يجب أن يكون تغيير السرعات ناعمًا، دون رجّات أو انزلاق.

## 5. تجربة القيادة

خصّص 20 إلى 30 دقيقة على الأقل، على مسار متنوع: مدينة، طريق، منحدر، خط مستقيم. قبل الانطلاق اسأل هل يغطي تأمين السيارة التجربة، وأبقِ البائع إلى جانبك.

- أطفئ المذياع وأصغِ: قرقعة، هدير، صفير، أصوات التعليق على المطبّات.
- تكبح السيارة باستقامة، دون اهتزاز أو انحراف إلى جانب، ودون أن تغوص الدالة.
- لا ينحرف المقود إلى جانب ولا يهتز.
- يعمل القابض بوضوح دون انزلاق، وتتغيّر السرعات دون فرقعة.
- يبقى مؤشر الحرارة ثابتًا، ولا يضيء أي مصباح.
- بعد التجربة، اترك المحرك يعمل، ثم انظر تحت الغطاء وتحت السيارة: رائحة احتراق أو تسرّب جديد أو دخان إشارات لا يجوز تجاهلها.

## 6. الفحص عند مختص

إذا ترددت، أو كان المبلغ كبيرًا، فاطلب من ميكانيكي تثق به فحص السيارة، **تختاره أنت بنفسك** (لا الذي يوصي به البائع). يمكن للتشخيص الإلكتروني أن يكشف أعطالًا مسجّلة لا تراها العين. البائع الأمين لا يخشى الفحص: والرفض هو في حد ذاته جواب.

## 7. التفاوض

- استند إلى وقائع: تآكل ملحوظ، وأعمال منتظرة (اطلب تقدير كلفة تقريبيًا)، وأسعار إعلانات مماثلة.
- لا تعلن أقصى ميزانيتك، ولا تتفاوض قبل أن تتحقق من كل شيء: الوثائق والفحص والتجربة.
- ابقَ هادئًا ومستعدًا للانصراف: الصفقة الجيدة لا تختفي لأنك أخذت يومًا للتفكير.
- اطلب تأكيد ما وُعدت به كتابةً: إصلاح على نفقة البائع، وملحقات مشمولة، ونسخة ثانية من المفاتيح.

## 8. إتمام الصفقة بأمان

- التقِ البائع في مكان يرتاده الناس، نهارًا، ويُفضّل أن ترافقك شخص آخر.
- لا تدفع شيئًا قبل أن ترى السيارة وتتحقق من الوثائق وتتفقا على كل شيء.
- فضّل وسيلة دفع يمكن تتبّعها، واطلب وصلًا مكتوبًا يبيّن المبلغ والتاريخ والسيارة (رقم التسلسل) وهوية الطرفين. تجنّب حمل مبالغ نقدية كبيرة.
- اطلب تحرير عقد البيع وفق القواعد المعمول بها، **بالسعر المدفوع فعلًا**: تخفيض السعر في الورق يحرمك من حق الرجوع وقد تترتب عليه عواقب قانونية.
- سجّل تغيير صاحب البطاقة الرمادية باسمك، في الآجال ووفق إجراءات الإدارة المختصة: ما دام لم يتم ذلك، يبقى البائع هو صاحبها الرسمي.
- أمّن السيارة باسمك قبل أن تقودها.
- احتفظ بجميع الوثائق: العقد والوصل والدفتر والفواتير ورسائل المحادثة.

## 9. بعد الشراء

اجعل السيارة تُفحص وتُصان دون تأخير: تغيير الزيت والمرشّحات، والمكابح، والعجلات، وسير التوقيت إذا لم يكن استبداله موثّقًا. دوّن تاريخ الشراء والمسافة المقطوعة، فهما نقطة انطلاق لمتابعتك.

لتُبلَّغ بالإعلانات الجديدة المطابقة لبحثك، أنشئ تنبيهًا من حسابك.`;

export const GENERAL_BUYING_GUIDE = {
  titleFr: "Acheter une voiture d'occasion : le guide complet, étape par étape",
  titleAr: "شراء سيارة مستعملة: الدليل الكامل خطوة بخطوة",
  excerptFr:
    "Avant de contacter le vendeur, en visite, à l'essai, à la négociation, à la signature : ce qu'il faut vérifier à chaque étape pour acheter une voiture d'occasion sans mauvaise surprise.",
  excerptAr: "قبل التواصل مع البائع، وعند المعاينة، وأثناء التجربة والتفاوض والتوقيع: ما يجب التحقق منه في كل مرحلة لشراء سيارة مستعملة دون مفاجآت سيئة.",
  contentFr,
  contentAr,
  checklistFr: checklistFr.join("\n"),
  checklistAr: checklistAr.join("\n"),
  adviceFr:
    "Ne vous engagez jamais sous la pression : une bonne voiture se vend sans précipitation. Si le vendeur refuse la visite, l'essai ou l'examen par un mécanicien, ou réclame de l'argent avant que vous ayez vu le véhicule, passez votre chemin.",
  adviceAr: "لا تلتزم أبدًا تحت الضغط: السيارة الجيدة تُباع دون استعجال. إذا رفض البائع المعاينة أو التجربة أو الفحص عند ميكانيكي، أو طلب مالًا قبل أن ترى السيارة، فابتعد.",
} as const;
