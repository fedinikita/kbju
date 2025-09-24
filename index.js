const TelegramBot = require('node-telegram-bot-api');
const {BOT_TOKEN} = process.env;
const bot = new TelegramBot(BOT_TOKEN, {polling: true});

// Хранилище данных пользователей
const userData = new Map();

// Состояния бота
const BOT_STATES = {
    AWAITING_START_WEIGHT: 'awaiting_start_weight',
    AWAITING_END_WEIGHT: 'awaiting_end_weight',
    AWAITING_PROTEIN: 'awaiting_protein',
    AWAITING_FAT: 'awaiting_fat',
    AWAITING_CARBS: 'awaiting_carbs',
    READY_FOR_CALCULATION: 'ready_for_calculation',
    EDITING_PARAMETER: 'editing_parameter'
};

const startWeightValidation = (value) => {ВВ
    const isNotValid = isNaN(value) || value <= 0 || value > 10_000;
    if (isNotValid) {
        return '❌ Пожалуйста, введите корректный вес (от 1 до 10000 грамм):';
    }
};

const endWeightValidation = (value) => {
    const isNotValid = isNaN(value) || value <= 0 || value > 100_000;
    if (isNotValid) {
        return '❌ Пожалуйста, введите корректный вес (от 1 до 100000 грамм):';
    }
};

const pfcValidation = (value, chatId, param) => {
    const paramMap = {
        'protein': 'белков',
        'fat': 'жиров',
        'carbs': 'углеводов',
    }
    const isNotValid = isNaN(value) || value < 0 || value > 100;
    if (isNotValid) {
        return `❌ Пожалуйста, введите корректное значение ${paramMap[param]} (0-100 г на 100г продукта):`;
    }
    const user = userData.get(chatId);
    const pfc = ['protein', 'fat', 'carbs'].filter(el => el != param);
    if (pfc.reduce((acc, el) => acc + user[el], value) > 100) {
        return '❌ Сумма БЖУ не должна превышать 100';
    }
};

// Обработка исходного веса
const handleStartWeightInput = (chatId, text) => {
    const weight = parseFloat(text.replace(',', '.'));

    const errorMessage = startWeightValidation(weight);
    if (errorMessage) {
        bot.sendMessage(chatId, errorMessage);
        return;
    }

    const user = userData.get(chatId);
    user.startWeight = weight;
    user.state = BOT_STATES.AWAITING_END_WEIGHT;
    userData.set(chatId, user);

    bot.sendMessage(chatId, `✅ Исходный вес: ${weight} г\n\n📉 Введите вес готового продукта в граммах:`);
};

// Обработка конечного веса
const handleEndWeightInput = (chatId, text) => {
    const weight = parseFloat(text.replace(',', '.'));

    const errorMessage = endWeightValidation(weight);
    if (errorMessage) {
        bot.sendMessage(chatId, errorMessage);
        return;
    }

    const user = userData.get(chatId);
    user.endWeight = weight;
    user.state = BOT_STATES.AWAITING_PROTEIN;
    userData.set(chatId, user);

    const changePercentage = ((user.startWeight - weight) / user.startWeight * 100).toFixed(1);

    bot.sendMessage(chatId,
        `✅ Вес готового продукта: ${weight} г\n` +
        `📊 Изменение веса: ${changePercentage > 1 ? changePercentage : changePercentage * -1}%\n\n` +
        `🥩 Введите содержание БЕЛКОВ в 100г исходного продукта (г):`);
};

// Обработка белков
const handleProteinInput = (chatId, text) => {
    const protein = parseFloat(text.replace(',', '.'));

    const errorMessage = pfcValidation(protein, chatId, 'protein');
    if (errorMessage) {
        bot.sendMessage(chatId, errorMessage);
        return;
    }

    const user = userData.get(chatId);
    user.protein = protein;
    user.state = BOT_STATES.AWAITING_FAT;
    userData.set(chatId, user);

    bot.sendMessage(chatId, `✅ Белки: ${protein} г/100г\n\n🥓 Введите содержание ЖИРОВ в 100г исходного продукта (г):`);
};

// Обработка жиров
const handleFatInput = (chatId, text) => {
    const fat = parseFloat(text.replace(',', '.'));

    const errorMessage = pfcValidation(fat, chatId, 'fat');
    if (errorMessage) {
        bot.sendMessage(chatId, errorMessage);
        return;
    }

    const user = userData.get(chatId);
    user.fat = fat;
    user.state = BOT_STATES.AWAITING_CARBS;
    userData.set(chatId, user);

    bot.sendMessage(chatId, `✅ Жиры: ${fat} г/100г\n\n🍚 Введите содержание УГЛЕВОДОВ в 100г исходного продукта (г):`);
};

// Обработка углеводов
const handleCarbsInput = (chatId, text) => {
    const carbs = parseFloat(text.replace(',', '.'));

    const errorMessage = pfcValidation(carbs, chatId, 'carbs');
    if (errorMessage) {
        bot.sendMessage(chatId, errorMessage);
        return;
    }

    const user = userData.get(chatId);
    user.carbs = carbs;
    user.state = BOT_STATES.READY_FOR_CALCULATION;
    userData.set(chatId, user);

    showSummary(chatId);
};

// Показать сводку с кнопками
const showSummary = (chatId) => {
    const user = userData.get(chatId);

    const summary = `📋 Собранные данные:\n\n` +
        `⚖️ Исходный вес: ${user.startWeight} г\n` +
        `⚖️ Вес готового: ${user.endWeight} г\n` +
        `🥩 Белки: ${user.protein} г/100г\n` +
        `🥓 Жиры: ${user.fat} г/100г\n` +
        `🍚 Углеводы: ${user.carbs} г/100г\n\n` +
        `Нажмите "🧮 Рассчитать КБЖУ" для получения результатов!`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🧮 Рассчитать КБЖУ', callback_data: 'calculate_kbju' }],
                [{ text: '✏️ Изменить данные', callback_data: 'edit_data' }]
            ]
        }
    };

    bot.sendMessage(chatId, summary, keyboard);
};

// Показать клавиатуру для выбора параметра редактирования
const showEditKeyboard = (chatId) => {
    const user = userData.get(chatId);

    const editText = `📝 Выберите параметр для изменения:`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `⚖️ Исходный вес (${user.startWeight}г)`, callback_data: 'edit_start_weight' },
                    { text: `⚖️ Вес готового (${user.endWeight}г)`, callback_data: 'edit_end_weight' }
                ],
                [
                    { text: `🥩 Белки (${user.protein}г)`, callback_data: 'edit_protein' },
                    { text: `🥓 Жиры (${user.fat}г)`, callback_data: 'edit_fat' }
                ],
                [
                    { text: `🍚 Углеводы (${user.carbs}г)`, callback_data: 'edit_carbs' }
                ],
                [
                    { text: '✅ Завершить редактирование', callback_data: 'finish_editing' }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, editText, keyboard);
};

// Начать редактирование параметра
const startParameterEdit = (chatId, param, description) => {
    const user = userData.get(chatId);
    user.state = BOT_STATES.EDITING_PARAMETER;
    user.editingParam = param;
    userData.set(chatId, user);

    let currentValue = '';
    switch (param) {
        case 'start_weight': currentValue = user.startWeight; break;
        case 'end_weight': currentValue = user.endWeight; break;
        case 'protein': currentValue = user.protein; break;
        case 'fat': currentValue = user.fat; break;
        case 'carbs': currentValue = user.carbs; break;
    }

    const message = `✏️ Редактирование параметра\n\n` +
        `Текущее значение: ${currentValue}\n\n` +
        `Введите новое значение ${description}:`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '↩️ Отменить редактирование', callback_data: 'back_to_edit' }]
            ]
        }
    };

    bot.sendMessage(chatId, message, keyboard);
};

// Обработка ввода нового значения параметра
const handleParameterEdit = (chatId, text, param) => {
    const value = parseFloat(text.replace(',', '.'));
    const user = userData.get(chatId);

    // Валидация в зависимости от параметра
    let errorMessage = '';

    switch (param) {
        case 'start_weight':
            errorMessage = startWeightValidation(value);
            break;
        case 'end_weight':
            errorMessage = endWeightValidation(value);
            break;
        case 'protein':
        case 'fat':
        case 'carbs':
            errorMessage = pfcValidation(value, chatId, param);
            break;
    }

    if (errorMessage) {
        bot.sendMessage(chatId, errorMessage);
        return;
    }

    // Обновляем значение параметра
    switch (param) {
        case 'start_weight': user.startWeight = value; break;
        case 'end_weight': user.endWeight = value; break;
        case 'protein': user.protein = value; break;
        case 'fat': user.fat = value; break;
        case 'carbs': user.carbs = value; break;
    }

    user.state = BOT_STATES.READY_FOR_CALCULATION;
    delete user.editingParam;
    userData.set(chatId, user);

    bot.sendMessage(chatId, `✅ Параметр успешно обновлен!`);
    showSummary(chatId);
};

// Основная функция расчета КБЖУ
const calculateKBJU = (chatId) => {
    const user = userData.get(chatId);

    if (!user) {
        bot.sendMessage(chatId, '❌ Данные не найдены. Начните с команды /start');
        return;
    }

    // Расчет по вашему скрипту
    const density = Number((user.startWeight / user.endWeight).toFixed(2));
    const PFC = [user.protein, user.fat, user.carbs];
    const [newPP100, newFP100, newCP100] = PFC.map(el => Number((el * density).toFixed(1)));

    const caloriesPer100g = Number((newPP100 * 4 + newFP100 * 9 + newCP100 * 4).toFixed(1));
    const totalCalories = Number((caloriesPer100g * user.endWeight / 100).toFixed(1));

    // Расчет для всего готового продукта
    const totalProtein = Number((newPP100 * user.endWeight / 100).toFixed(1));
    const totalFat = Number((newFP100 * user.endWeight / 100).toFixed(1));
    const totalCarbs = Number((newCP100 * user.endWeight / 100).toFixed(1));

    // Формируем отчет
    const report = `📊 РЕЗУЛЬТАТЫ РАСЧЕТА КБЖУ\n\n` +
        `🔹 Коэффициент ${density > 1 ? 'уварки/ужарки' : 'поглощения'}: ${density}x\n\n` +
        `📈 На 100г ГОТОВОГО продукта:\n` +
        `🥩 Белки: ${newPP100} г\n` +
        `🥓 Жиры: ${newFP100} г\n` +
        `🍚 Углеводы: ${newCP100} г\n` +
        `🔥 Калории: ${caloriesPer100g} ккал\n\n` +
        `📦 На всю порцию (${user.endWeight}г):\n` +
        `🥩 Белки: ${totalProtein} г\n` +
        `🥓 Жиры: ${totalFat} г\n` +
        `🍚 Углеводы: ${totalCarbs} г\n` +
        `🔥 Калории: ${totalCalories} ккал`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '📋 Детали расчета', callback_data: 'show_details' }],
                [{ text: '✏️ Изменить данные', callback_data: 'edit_data' }],
                [{ text: '🔄 Новый расчет', callback_data: 'new_calculation' }]
            ]
        }
    };

    bot.sendMessage(chatId, report, keyboard);
};

// Детальный расчет
const showDetailedCalculation = (chatId) => {
    const user = userData.get(chatId);
    const density = Number((user.startWeight / user.endWeight).toFixed(2));

    const details = `🔍 ДЕТАЛИ РАСЧЕТА:\n\n` +
        `📐 Формула: (Исходный вес / Вес готового) * КБЖУ на 100г\n\n` +
        `📊 Расчет коэффициента:\n` +
        `${user.startWeight}г / ${user.endWeight}г = ${density}\n\n` +
        `🧮 Расчет на 100г готового:\n` +
        `Белки: ${user.protein}г × ${density} = ${(user.protein * density).toFixed(1)}г\n` +
        `Жиры: ${user.fat}г × ${density} = ${(user.fat * density).toFixed(1)}г\n` +
        `Углеводы: ${user.carbs}г × ${density} = ${(user.carbs * density).toFixed(1)}г`;

    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '↩️ Назад к результатам', callback_data: 'calculate_kbju' }],
                [{ text: '✏️ Изменить данные', callback_data: 'edit_data' }]
            ]
        }
    };

    bot.sendMessage(chatId, details, keyboard);
};

// Перезапуск процесса
const restartProcess = (chatId) => {
    userData.delete(chatId);
    bot.sendMessage(chatId, '🔄 Начинаем новый расчет КБЖУ!\n\nВведите команду /start');
};


// Обработка нажатий на кнопки
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const user = userData.get(chatId);

    switch (data) {
        case 'calculate_kbju':
            calculateKBJU(chatId);
            break;
        case 'edit_data':
            showEditKeyboard(chatId);
            break;
        case 'finish_editing':
            user.state = BOT_STATES.READY_FOR_CALCULATION;
            userData.set(chatId, user);
            showSummary(chatId);
            break;
        case 'edit_start_weight':
            startParameterEdit(chatId, 'start_weight', 'исходный вес в граммах');
            break;
        case 'edit_end_weight':
            startParameterEdit(chatId, 'end_weight', 'вес готового продукта в граммах');
            break;
        case 'edit_protein':
            startParameterEdit(chatId, 'protein', 'содержание белков в 100г исходного продукта (г)');
            break;
        case 'edit_fat':
            startParameterEdit(chatId, 'fat', 'содержание жиров в 100г исходного продукта (г)');
            break;
        case 'edit_carbs':
            startParameterEdit(chatId, 'carbs', 'содержание углеводов в 100г исходного продукта (г)');
            break;
        case 'new_calculation':
            restartProcess(chatId);
            break;
        case 'show_details':
            showDetailedCalculation(chatId);
            break;
        case 'back_to_edit':
            showEditKeyboard(chatId);
            break;
    }

    bot.answerCallbackQuery(callbackQuery.id);
});

// Команда /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    userData.set(chatId, {
        state: BOT_STATES.AWAITING_START_WEIGHT,
        startWeight: 0,
        endWeight: 0,
        protein: 0,
        fat: 0,
        carbs: 0
    });

    const welcomeText = `🔬 Калькулятор КБЖУ готового продукта\n\n` +
        `Я помогу рассчитать пищевую ценность готового блюда с учетом уварки/ужарки.\n\n` +
        `📊 Введите исходный вес продукта в граммах:`;

    
    console.log('Воспользовался ботом: ', chatId);
    bot.sendMessage(chatId, welcomeText);
});

// Обработка всех сообщений
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text.startsWith('/') && text !== '/start') return;

    const user = userData.get(chatId);
    if (!user) return;

    switch (user.state) {
        case BOT_STATES.AWAITING_START_WEIGHT:
            handleStartWeightInput(chatId, text);
            break;
        case BOT_STATES.AWAITING_END_WEIGHT:
            handleEndWeightInput(chatId, text);
            break;
        case BOT_STATES.AWAITING_PROTEIN:
            handleProteinInput(chatId, text);
            break;
        case BOT_STATES.AWAITING_FAT:
            handleFatInput(chatId, text);
            break;
        case BOT_STATES.AWAITING_CARBS:
            handleCarbsInput(chatId, text);
            break;
        case BOT_STATES.EDITING_PARAMETER:
            handleParameterEdit(chatId, text, user.editingParam);
            break;
        case BOT_STATES.READY_FOR_CALCULATION:
            // Обработка обычных сообщений в режиме готовности
            break;
    }
});

// Обработка ошибок
bot.on('error', (error) => {
    console.error('Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
    console.log(`[polling_error] ${error.code}: ${error.message}`);
});

console.log('🔬 Бот для расчета КБЖУ с редактированием запущен!');