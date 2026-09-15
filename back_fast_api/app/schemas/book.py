from pydantic import BaseModel, ConfigDict


class BookBase(BaseModel):
    title: str
    author: str | None = None
    publisher: str | None = None
    publication_year: int | None = None


class BookCreate(BookBase):
    stock: int = 0


class BookResponse(BookBase):
    id: int
    stock: int

    model_config = ConfigDict(from_attributes=True)
