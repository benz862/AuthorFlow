import { createClient } from '@/lib/supabase/server'
import { EntitlementResult, BookCategory, CATEGORY_ORDER } from '@/lib/types/app'
import { PlanLimits } from '@/lib/types/database'

type ActionType =
  | 'create_project'
  | 'research_project'
  | 'generate_outline'
  | 'generate_chapter'
  | 'regenerate_chapter'
  | 'generate_cover'
  | 'generate_illustration'
  | 'export_pdf'
  | 'export_text'
  | 'save_version'
  | 'access_source_vault'
  | 'children_mode'

export async function checkEntitlement(
  userId: string,
  action: ActionType,
  context?: { category?: BookCategory; activeProjectCount?: number }
): Promise<EntitlementResult> {
  const supabase = await createClient()

  const [subResult, limitsResult, usageResult] = await Promise.all([
    supabase.from('subscription_status').select('*').eq('user_id', userId).single(),
    supabase.from('plan_limits').select('*').eq('plan_code',
      (await supabase.from('subscription_status').select('plan_code').eq('user_id', userId).single()).data?.plan_code ?? 'freedom'
    ).single(),
    supabase.rpc('get_or_create_usage', { p_user_id: userId }),
  ])

  const sub = subResult.data
  const limits = limitsResult.data as PlanLimits | null
  const usage = usageResult.data

  if (!sub || !limits) {
    return { allowed: false, reason: 'Could not determine subscription state.' }
  }

  if (!['active', 'trialing'].includes(sub.subscription_status) && sub.plan_code !== 'freedom') {
    return {
      allowed: false,
      reason: 'Your subscription is not active.',
      upgradeMessage: 'Please update your billing to continue.',
    }
  }

  const getPlanUpgradeMessage = (neededPlan: string) => {
    const messages: Record<string, string> = {
      starter: 'Upgrade to Starter ($12/mo) to unlock this feature.',
      creator: 'Upgrade to Creator ($29/mo) to unlock this feature.',
      studio: 'Upgrade to Studio ($59/mo) to unlock this feature.',
      unlimited: 'Upgrade to Unlimited ($99/mo) for maximum access.',
    }
    return messages[neededPlan] ?? 'Upgrade your plan to unlock this feature.'
  }

  switch (action) {
    case 'create_project': {
      const activeCount = context?.activeProjectCount ?? 0
      const maxProjects = limits.max_active_projects ?? 1
      if (activeCount >= maxProjects) {
        return {
          allowed: false,
          reason: `You've reached your limit of ${maxProjects} active project${maxProjects === 1 ? '' : 's'}.`,
          upgradeMessage: getPlanUpgradeMessage('starter'),
          upgradePlan: 'starter',
        }
      }
      const booksThisMonth = usage?.books_created ?? 0
      const maxBooks = limits.max_books_per_month ?? 1
      if (booksThisMonth >= maxBooks) {
        return {
          allowed: false,
          reason: `You've created ${booksThisMonth} book${booksThisMonth === 1 ? '' : 's'} this month (limit: ${maxBooks}).`,
          upgradeMessage: getPlanUpgradeMessage('starter'),
          upgradePlan: 'starter',
        }
      }
      return { allowed: true }
    }

    case 'research_project':
    case 'generate_outline':
    case 'generate_chapter': {
      const requestedCategory = context?.category ?? 'freebie'
      const maxCategory = limits.max_category ?? 'freebie'
      const requestedIdx = CATEGORY_ORDER.indexOf(requestedCategory)
      const maxIdx = CATEGORY_ORDER.indexOf(maxCategory as BookCategory)
      if (requestedIdx > maxIdx) {
        return {
          allowed: false,
          reason: `Your plan doesn't support ${requestedCategory} books.`,
          upgradeMessage: getPlanUpgradeMessage('creator'),
          upgradePlan: 'creator',
        }
      }
      return { allowed: true }
    }

    case 'regenerate_chapter': {
      const regens = usage?.regenerations ?? 0
      const maxRegens = limits.monthly_regenerations ?? 0
      if (regens >= maxRegens) {
        return {
          allowed: false,
          reason: `You've used all ${maxRegens} regenerations this month.`,
          upgradeMessage: getPlanUpgradeMessage('creator'),
          upgradePlan: 'creator',
        }
      }
      return { allowed: true }
    }

    case 'generate_cover': {
      const covers = usage?.cover_generations ?? 0
      const maxCovers = limits.monthly_cover_generations ?? 0
      if (covers >= maxCovers) {
        return {
          allowed: false,
          reason: `You've used all ${maxCovers} cover generation${maxCovers === 1 ? '' : 's'} this month.`,
          upgradeMessage: getPlanUpgradeMessage('starter'),
          upgradePlan: 'starter',
        }
      }
      return { allowed: true }
    }

    case 'generate_illustration': {
      if (!limits.children_mode_enabled) {
        return {
          allowed: false,
          reason: "Children's book illustration mode requires Studio or higher.",
          upgradeMessage: getPlanUpgradeMessage('studio'),
          upgradePlan: 'studio',
        }
      }
      const illus = usage?.illustration_generations ?? 0
      const maxIllus = limits.monthly_illustration_generations ?? 0
      if (illus >= maxIllus) {
        return {
          allowed: false,
          reason: `You've used all ${maxIllus} illustration generations this month.`,
          upgradeMessage: getPlanUpgradeMessage('unlimited'),
          upgradePlan: 'unlimited',
        }
      }
      return { allowed: true }
    }

    case 'export_pdf': {
      const exports = usage?.pdf_exports ?? 0
      const maxExports = limits.monthly_pdf_exports ?? 0
      if (exports >= maxExports) {
        return {
          allowed: false,
          reason: `You've used all ${maxExports} PDF export${maxExports === 1 ? '' : 's'} this month.`,
          upgradeMessage: getPlanUpgradeMessage('starter'),
          upgradePlan: 'starter',
        }
      }
      return { allowed: true }
    }

    case 'export_text': {
      const exports = usage?.text_exports ?? 0
      const maxExports = limits.monthly_text_exports ?? 0
      if (exports >= maxExports) {
        return {
          allowed: false,
          reason: `You've used all ${maxExports} text exports this month.`,
          upgradeMessage: getPlanUpgradeMessage('starter'),
          upgradePlan: 'starter',
        }
      }
      return { allowed: true }
    }

    case 'save_version': {
      if (!limits.version_history_enabled) {
        return {
          allowed: false,
          reason: 'Version history requires Creator or higher.',
          upgradeMessage: getPlanUpgradeMessage('creator'),
          upgradePlan: 'creator',
        }
      }
      return { allowed: true }
    }

    case 'access_source_vault': {
      if (!limits.source_vault_enabled) {
        return {
          allowed: false,
          reason: 'Source vault requires Creator or higher.',
          upgradeMessage: getPlanUpgradeMessage('creator'),
          upgradePlan: 'creator',
        }
      }
      return { allowed: true }
    }

    case 'children_mode': {
      if (!limits.children_mode_enabled) {
        return {
          allowed: false,
          reason: "Children's illustration mode requires Studio or higher.",
          upgradeMessage: getPlanUpgradeMessage('studio'),
          upgradePlan: 'studio',
        }
      }
      return { allowed: true }
    }

    default:
      return { allowed: true }
  }
}
