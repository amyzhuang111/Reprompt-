"""Basket routes: list baskets, run basket."""

from fastapi import APIRouter, HTTPException

from reprompt.models import BasketResult
from reprompt.services.basket_runner import list_baskets, run_basket

router = APIRouter()


@router.get("/baskets", response_model=list[str])
async def get_baskets() -> list[str]:
    return list_baskets()


@router.post("/baskets/{name}/run", response_model=BasketResult)
async def run_basket_endpoint(name: str) -> BasketResult:
    try:
        return await run_basket(name)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Basket '{name}' not found")
