# 🚀 Финальная миграция для функционала админа

## Что изменилось:

### 1. База данных
- ✅ Добавлено поле `is_admin` в таблицу `profiles`
- ✅ Создана функция `is_admin()` для проверки прав (избегает циклической зависимости RLS)
- ✅ Настроены RLS политики с двумя отдельными политиками для каждой таблицы
- ✅ Админ может просматривать все профили, тренировки и сеты

### 2. Frontend
- ✅ Селектор пользователей виден только админам
- ✅ Значок "👑 ADMIN" показывается в настройках профиля
- ✅ Обновлены TypeScript типы

---

## 📝 Инструкция по применению:

### Шаг 1: Откройте Supabase Dashboard
https://supabase.com/dashboard/project/gjcbspomrqajtkjfevsf

### Шаг 2: Перейдите в SQL Editor
В левом меню найдите **SQL Editor** → **New query**

### Шаг 3: Скопируйте и выполните этот SQL

```sql
-- COMPLETE ROLLBACK AND PROPER FIX

-- 1. Drop all policies
DROP POLICY IF EXISTS "Users can view own profile or admin can view all" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own workouts or admin can view all" ON public.workouts;
DROP POLICY IF EXISTS "Users can view own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Admins can view all workouts" ON public.workouts;

DROP POLICY IF EXISTS "Users can view own workout sets or admin can view all" ON public.workout_sets;
DROP POLICY IF EXISTS "Users can view own workout sets" ON public.workout_sets;
DROP POLICY IF EXISTS "Admins can view all workout sets" ON public.workout_sets;

-- 2. Create a SECURITY DEFINER function to check admin status (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE user_id = user_uuid LIMIT 1),
    false
  );
$$;

-- 3. Create new policies using the function

-- Profiles policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin(auth.uid()));

-- Workouts policies
CREATE POLICY "Users can view own workouts"
ON public.workouts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all workouts"
ON public.workouts FOR SELECT
USING (public.is_admin(auth.uid()));

-- Workout sets policies
CREATE POLICY "Users can view own workout sets"
ON public.workout_sets FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.workouts w
    WHERE w.id = workout_sets.workout_id AND w.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all workout sets"
ON public.workout_sets FOR SELECT
USING (public.is_admin(auth.uid()));
```

### Шаг 4: Нажмите **Run** (или Ctrl+Enter)

Вы должны увидеть сообщение об успешном выполнении.

---

## ✅ Проверка после применения:

1. **Обновите страницу приложения** (Ctrl+R или F5)
2. **Войдите как админ** (iljacrc@gmail.com)
3. **Проверьте настройки профиля** - должна быть видна табличка "👑 ADMIN"
4. **Проверьте страницу "Тренировки"** - должен быть виден селектор пользователей
5. **Выберите другого пользователя** - должны отображаться его тренировки
6. **Войдите под другим пользователем** - селектора НЕ должно быть

---

## 🎯 Что получится в результате:

### Для админа (iljacrc@gmail.com):
- ✅ Видит значок "👑 ADMIN" в настройках профиля рядом с возрастом
- ✅ Видит селектор всех пользователей на странице "Тренировки"
- ✅ Может просматривать тренировки любого пользователя
- ✅ Может просматривать профили всех пользователей

### Для обычных пользователей:
- ❌ НЕ видят значок админа
- ❌ НЕ видят селектор пользователей
- ❌ НЕ могут просматривать чужие тренировки
- ✅ Видят только свои тренировки и свой профиль

---

## 🔧 Техническая информация:

**Ключевое решение проблемы циклической зависимости:**
- Использована функция `SECURITY DEFINER` для обхода RLS при проверке прав
- Две отдельные политики для каждой таблицы вместо одной с `OR`
- Функция `is_admin()` кэшируется благодаря флагу `STABLE`

**Файлы, которые были изменены:**
1. `supabase/migrations/20260111000002_fix_admin_with_function.sql` - финальная миграция
2. `src/hooks/useProfile.ts` - добавлено поле `is_admin: boolean`
3. `src/hooks/useAllProfiles.ts` - запрашивает `is_admin` из БД
4. `src/pages/Workouts.tsx` - селектор условно рендерится для админов
5. `src/pages/Settings.tsx` - добавлен значок "👑 ADMIN"

---

## 🆘 Если что-то пошло не так:

Выполните этот SQL для отката к исходному состоянию (БЕЗ админ-функционала):

```sql
-- Rollback to original state
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all workouts" ON public.workouts;
DROP POLICY IF EXISTS "Admins can view all workout sets" ON public.workout_sets;
DROP FUNCTION IF EXISTS public.is_admin(UUID);

-- Just keep the basic policies
-- (Users can view own profile/workouts policies should remain)
```

Затем напишите мне, и я помогу разобраться!
