import asyncio
import logging
import sys
from uuid import UUID

from sqlalchemy import select
from app.database import async_session
from app.models import Ticket
from app.services.ticket_generator import get_ticket_generator

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def main():
    logger.info("Starting retroactive ticket relationship computation via Claude...")
    generator = get_ticket_generator()

    async with async_session() as session:
        # Fetch all active tickets ordered by creation time (oldest first)
        result = await session.execute(
            select(Ticket)
            .where(Ticket.status.in_(["draft", "created"]))
            .order_by(Ticket.created_at.asc())
        )
        tickets = result.scalars().all()

        if not tickets:
            logger.info("No active tickets found.")
            return

        logger.info(f"Loaded {len(tickets)} tickets. Analyzing relationships chronologically...")

        updated_count = 0
        for i, ticket in enumerate(tickets):
            if i == 0:
                continue  # No previous tickets to relate to
                
            if ticket.related_ticket_id:
                logger.info(f"Skipping {ticket.jira_ticket_id or ticket.id}: already has a relationship.")
                continue

            # Only consider tickets created *before* this one as possible dependencies
            existing_tickets = tickets[:i]

            # Build dummy dict for find_related_ticket prompt context
            ticket_data = {
                "title": ticket.title,
                "description": ticket.description,
            }

            logger.info(f"Analyzing {ticket.jira_ticket_id or ticket.id} ({ticket.title})...")
            try:
                relation_data = await generator.find_related_ticket(ticket_data, existing_tickets)
                if relation_data and relation_data.get("related_ticket_id"):
                    related_id_str = relation_data["related_ticket_id"]
                    try:
                        ticket.related_ticket_id = UUID(related_id_str)
                        ticket.relation_type = relation_data.get("relation_type", "similar_to")
                        logger.info(f"  -> MATCH FOUND! {ticket.jira_ticket_id or ticket.id} {ticket.relation_type} {related_id_str}")
                        updated_count += 1
                        # Save relationship
                        session.add(ticket)
                        await session.commit()
                    except ValueError:
                        logger.warning(f"  -> Invalid UUID returned: {related_id_str}")
                else:
                    logger.info("  -> No relationship detected.")
            except Exception as e:
                logger.error(f"  -> Error calling Claude: {e}")

        logger.info(f"Done! Updated relationships for {updated_count} tickets.")


if __name__ == "__main__":
    asyncio.run(main())
